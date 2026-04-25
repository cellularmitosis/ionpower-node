#!/opt/tigersh-deps-0.1/bin/bash
# Build autoconf 2.13 for Mozilla-era configure.in scripts.
set -e -o pipefail
PATH=/opt/tigersh-deps-0.1/bin:$PATH
SCRATCH=/Users/macuser/tmp
CA=/opt/ca-certificates-20230110/share/cacert.pem

cd "$SCRATCH"
if [ ! -f autoconf-2.13.tar.gz ]; then
    curl -fsSL --cacert "$CA" -o autoconf-2.13.tar.gz \
        https://ftp.gnu.org/gnu/autoconf/autoconf-2.13.tar.gz
fi

rm -rf autoconf-2.13
tar xzf autoconf-2.13.tar.gz
cd autoconf-2.13

./configure --prefix=/opt/autoconf-2.13 --program-suffix=213
make
make install

# autoconf 2.13 installed binaries are named `autoconf213` thanks to suffix.
/opt/autoconf-2.13/bin/autoconf213 --version | head -1
echo "OK: autoconf-2.13 installed"
