// demos/npm-install/run.js — invoke real npm-6.14.18 to install a
// vendored tarball (mri@1.2.0) under our runtime, then require the
// installed package and prove it works.
//
// Expects npm-6.14.18 to be unpacked at /Users/macuser/tmp/npm-6.14.18
// (the standard fleet location since pass-3). If your layout differs,
// set NPM_CLI_JS to the path of npm-cli.js before running.

var path     = require('path');
var fs       = require('fs');
var child    = require('child_process');

var demoDir = __dirname;
var tmpDir  = path.join(demoDir, 'tmp');
var tarball = path.join(demoDir, 'fixtures', 'mri-1.2.0.tgz');
var npmCli  = process.env.NPM_CLI_JS
           || '/Users/macuser/tmp/npm-6.14.18/bin/npm-cli.js';

if (!fs.existsSync(tarball)) {
    console.error('error: fixture missing: ' + tarball);
    process.exit(1);
}
if (!fs.existsSync(npmCli)) {
    console.error('error: npm-cli.js not found at ' + npmCli);
    console.error('       set NPM_CLI_JS to a usable npm-6.14.18/bin/npm-cli.js');
    process.exit(1);
}

// Fresh tmp/ each run so the demo is idempotent.
function rmrf(p) {
    if (!fs.existsSync(p)) return;
    var st = fs.lstatSync(p);
    if (st.isDirectory()) {
        fs.readdirSync(p).forEach(function (f) { rmrf(path.join(p, f)); });
        fs.rmdirSync(p);
    } else {
        fs.unlinkSync(p);
    }
}
rmrf(tmpDir);
fs.mkdirSync(tmpDir);
// npm wants something to anchor the install root.
fs.writeFileSync(path.join(tmpDir, 'package.json'),
                 JSON.stringify({ name: 'npm-install-demo', version: '0.0.0' }, null, 2));

console.log('== ionpower-node npm-install demo ==');
console.log('   tarball: ' + tarball);
console.log('   cwd:     ' + tmpDir);
console.log('   npm:     ' + npmCli);
console.log('');
console.log('$ npm install ' + path.relative(tmpDir, tarball) + ' --no-audit');

var t0 = Date.now();
var res = child.spawnSync(process.execPath,
                          [npmCli, 'install', tarball, '--no-audit'],
                          { cwd: tmpDir, stdio: 'inherit' });

if (res.status !== 0) {
    console.error('FAIL: npm install exited ' + res.status);
    process.exit(res.status || 1);
}

var modPath = path.join(tmpDir, 'node_modules', 'mri');
if (!fs.existsSync(modPath)) {
    console.error('FAIL: node_modules/mri missing after install');
    process.exit(1);
}

console.log('');
console.log('=== install completed in ' + (Date.now() - t0) + ' ms ===');
console.log('');
console.log('require() sanity check:');

// Switch require's resolution root to the freshly installed mri.
var mri = require(path.join(modPath, 'package.json')).main
        ? require(path.join(modPath, require(path.join(modPath, 'package.json')).main))
        : require(modPath);

var parsed = mri(['--port', '8080', '--verbose', 'extra1', 'extra2']);
console.log('   mri(["--port","8080","--verbose","extra1","extra2"]) =>');
console.log('   ' + JSON.stringify(parsed));

if (parsed.port !== 8080 || parsed.verbose !== true) {
    console.error('FAIL: mri output unexpected');
    process.exit(1);
}
console.log('');
console.log('PASS: mri installed via real npm-6 and parses argv correctly');
