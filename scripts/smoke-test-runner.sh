#!/bin/bash
# Note: keep in mind we are running bash 2.05b.

# smoke-test-runner.sh: run the tests listed in $1.

# Each file listed in $1 is run using ./node
# and output is captured to a tmp dir.
# The name of the tmp dir is printed to stdout,
# and is the only output sent to stdout.

set -e

if test ! -e "./node" ; then
    echo "Error: ./node not found" >&2
    exit 1
fi

if test -z "$1" ; then
    echo "Error: no tests file specified" >&2
    exit 1
fi
testsfile="$1"
if test ! -e "$testsfile" ; then
    echo "Error: tests file \"$testsfile\" not found" >&2
    exit 1
fi
echo "Running tests listed in $testsfile" >&2

# Create a dir in /tmp to capture test results.
tmpdir="/tmp/nodesmoke-$(date +%s)"
mkdir "$tmpdir"
# Print the tmpdir to stdout for easy capture
# This *must* be the only string printed to stdout by this script.
echo "$tmpdir"
# Also print a user-facing message to stderr.
echo "All test results are being captured in $tmpdir" >&2

# Resolve ./node to an absolute path so the bash -c subshell can find it
# regardless of where (or whether) /tmp is on its PATH.
node_abspath="$(pwd)/node"

while IFS= read -r test_fpath; do
    test_fname=$(basename "$test_fpath")
    echo -n "Testing $test_fpath" >&2
    testdir="$tmpdir/$test_fname"
    mkdir -p "$testdir"

    # Two named pipes feed two `tee` processes. Each tee writes a copy of
    # its stream to STDOUT or STDERR, and *appends* a copy to OUTPUT.
    # Both tees append to the same OUTPUT file; >> uses O_APPEND so
    # each write(2) lands atomically at the file's current end. Result:
    # stdout-only in STDOUT, stderr-only in STDERR, interleaved in
    # OUTPUT (modulo libc-buffered chunk granularity, which is fine for
    # smoke output).
    out_fifo="$testdir/.out-fifo"
    err_fifo="$testdir/.err-fifo"
    mkfifo "$out_fifo" "$err_fifo"
    : > "$testdir/OUTPUT"
    tee "$testdir/STDOUT" >> "$testdir/OUTPUT" < "$out_fifo" &
    tee_out_pid=$!
    tee "$testdir/STDERR" >> "$testdir/OUTPUT" < "$err_fifo" &
    tee_err_pid=$!

    # /usr/bin/time on Tiger has no -o flag, so we can't tell time(1)
    # to write its report to a separate file. Instead: run the command
    # inside a `bash -c` so the inner script can do its own redirection
    # for the program's stdout/stderr (into the FIFOs), independent of
    # time(1)'s own stderr (which we redirect to the TIME file).
    set +e
    /usr/bin/time -p -l bash -c \
        "\"$node_abspath\" \"\$0\" > \"\$1\" 2> \"\$2\"" \
        "$test_fpath" "$out_fifo" "$err_fifo" \
        2> "$testdir/TIME"
    status=$?
    set -e

    # Wait for tee processes to drain the FIFOs and flush their output.
    # Suppress "not a child of this shell" noise on Tiger bash 2.05b.
    wait "$tee_out_pid" "$tee_err_pid" 2>/dev/null || true
    rm -f "$out_fifo" "$err_fifo"

    echo "$status" > "$testdir/STATUS"
    if test "$status" -eq 0 ; then
        touch "$testdir/PASS"
        echo " PASS" >&2
    else
        touch "$testdir/FAIL"
        echo " FAIL" >&2
    fi
done < "$testsfile"

# Print some stats for the user.
set +e
passcount=$(find "$tmpdir" | grep '/PASS$' | wc -l | awk '{print $1}')
failcount=$(find "$tmpdir" | grep '/FAIL$' | wc -l | awk '{print $1}')
set -e
echo >&2
echo "$passcount passing tests" >&2
echo "$failcount failing tests" >&2

if test "$failcount" -ne 0 ; then
    echo "Failures may be investigated in $tmpdir" >&2
    echo "Hint: cd "$tmpdir" ; find . | grep '/FAIL$'" >&2
    exit 1
fi


# Example contents of TIME file:
#real         0.72
#user         0.54
#sys          0.13
#         0  maximum resident set size
#         0  average shared memory size
#         0  average unshared data size
#         0  average unshared stack size
#         0  page reclaims
#         0  page faults
#         0  swaps
#         0  block input operations
#         0  block output operations
#         1  messages sent
#         0  messages received
#         1  signals received
#         1  voluntary context switches
#         0  involuntary context switches
