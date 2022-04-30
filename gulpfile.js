/*jshint esversion: 8 */
const {
    readFileSync
} = require('fs');
const {
    src,
    dest,
    task
} = require('gulp');
const {
    series
} = require('gulp');
const jeditor = require('gulp-json-editor');
const rev = require('gulp-rev');
const revRewrite = require('gulp-rev-rewrite');
const extend = require('gulp-extend');
const minify = require('gulp-minify');
//const uglify = require('gulp-uglify');
const cleanCSS = require('gulp-clean-css');
//const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const runCommand = require('gulp-run-command').default;

/**** Shared Tasks ****/
task('clean', function (done) {
    return new Promise(function (resolve) {
        resolve(del.sync(['public/app/*/', 'public/home/*/'], done));
    });
});

/**** Home Tasks ****/
task('home_preDeployFirebase', function () {
    return src('./firebase.json')
        .pipe(jeditor(function (json) {
            json.hosting[0].public = 'public/home';
            return json;
        }))
        .pipe(dest("./"));
});

task('home_copyHomeFiles', function() {
    return src('src/home/**/*').pipe(dest('public/home'));
});

task('home_copyVendorFiles', function() {
    return src('src/vendor/**/*').pipe(dest('public/home/vendor'));
});

task('home_copyDependencies', function (done) {
    src('src/shared-assets/logo/**/*').pipe(dest('public/home/assets/logo'));
    src(['src/shared-assets/404.html', 'src/shared-assets/favicon.png']).pipe(dest('public/home'));
    done();
});

task('home_deploy', function(done) {
    runCommand('firebase deploy --only hosting:home')().then(done);
});

task('home_postDeployFirebase', function () {
    return src('./firebase.json')
        .pipe(jeditor(function (json) {
            json.hosting[0].public = 'src/home';
            return json;
        }))
        .pipe(dest("./"));
});

/**** App Tasks ****/
task('app_preDeployFirebase', function () {
    return src('./firebase.json')
        .pipe(jeditor(function (json) {
            json.hosting[1].public = 'public/app';
            return json;
        }))
        .pipe(dest("./"));
});

task('app_minifyCSS', function () {
    return src('src/app/css/*.css')
        .pipe(cleanCSS())
        .pipe(rev())
        .pipe(dest('public/app/css'))
        .pipe(rev.manifest())
        .pipe(dest('public/app/css'));
});

task('app_minifyJS', function () {
    return src('src/app/js/*.js')
        .pipe(minify({
            noSource: true,
            ext: {
                min: '.js'
            }
        }))
        .pipe(rev())
        .pipe(dest('public/app/js'))
        .pipe(rev.manifest())
        .pipe(dest('public/app/js'));
});

task('manifest', function () {
    return src(['public/app/js/*.json', 'public/app/css/*.json'])
        .pipe(extend('rev-manifest.json'))
        .pipe(dest('public/app'));
});

task('rewrite', function (done) {
    const manifest = readFileSync('public/app/rev-manifest.json');

    src('src/app/**/*.html')
        .pipe(revRewrite({
            manifest
        }))
        .pipe(dest('public/app'));

    //Copy minified app.css (without cache busting) as a dependency for shared recipes
    src('src/app/css/app.css').pipe(cleanCSS()).pipe(dest('public/app/css'));
    done();
});

task('app_copyVendorFiles', function() {
    return src('src/vendor/**/*').pipe(dest('public/app/vendor'));
});

task('app_copyDependencies', function (done) {
    src('src/app/assets/**/*').pipe(dest('public/app/assets'));
    src('src/shared-assets/logo/**/*').pipe(dest('public/app/assets/logo'));
    src('src/app/img/**/*').pipe(dest('public/app/img'));
    src(['src/shared-assets/404.html', 'src/shared-assets/favicon.png', 'src/app/*.json', 'src/app/*.js']).pipe(dest('public/app'));
    done();
});

task('app_deploy', function(done) {
    runCommand('firebase deploy --only hosting:app')().then(done);
});

task('app_postDeployFirebase', function () {
    return src('./firebase.json')
        .pipe(jeditor(function (json) {
            json.hosting[1].public = 'src/app';
            return json;
        }))
        .pipe(dest("./"));
});

//Shared tasks
const clean = task('clean');

//Home tasks
const home_preDeployFirebase = task('home_preDeployFirebase');
const home_copyHomeFiles = task('home_copyHomeFiles');
const home_copyVendorFiles = task('home_copyVendorFiles');
const home_copyDependencies = task('home_copyDependencies');
const home_deploy = task('home_deploy');
const home_postDeployFirebase = task('home_postDeployFirebase');

//App tasks
const app_preDeployFirebase = task('app_preDeployFirebase');
const app_minifyCSS = task('app_minifyCSS');
const app_minifyJS = task('app_minifyJS');
const manifest = task('manifest');
const rewrite = task('rewrite');
const app_copyVendorFiles = task('app_copyVendorFiles');
const app_copyDependencies = task('app_copyDependencies');
const app_deploy = task('app_deploy');
const app_postDeployFirebase = task('app_postDeployFirebase');

const home = series(
    home_preDeployFirebase,
    clean,
    home_copyHomeFiles,
    home_copyVendorFiles,
    home_copyDependencies,
    home_deploy,
    home_postDeployFirebase
);

const app = series(
    app_preDeployFirebase,
    clean,
    app_minifyCSS,
    app_minifyJS,
    manifest,
    rewrite,
    app_copyVendorFiles,
    app_copyDependencies,
    app_deploy,
    app_postDeployFirebase
);

exports.home = home;

exports.app = app;

exports.default = function(done) {
    console.log('');
    console.log('gulp home');
    console.log('==> Deploys home/product page');
    console.log('gulp home');
    console.log('gulp app');
    console.log('==> Deploys Pantry web app');
    console.log('');
    done();
};