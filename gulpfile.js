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

/**** Tasks ****/
task('predeployFirebase', function () {
    return src('./firebase.json')
        .pipe(jeditor(function (json) {
            json.hosting.public = 'public';
            return json;
        }))
        .pipe(dest("./"));
});

task('clean', function (done) {
    return new Promise(function (resolve) {
        resolve(del.sync(['public/*/'], done));
    });
});

task('minifyJS', function () {
    return src('src/js/*.js')
        .pipe(minify({
            noSource: true,
            ext: {
                min: '.js'
            }
        }))
        .pipe(rev())
        .pipe(dest('public/js'))
        .pipe(rev.manifest())
        .pipe(dest('public/js'));
});

task('minifyCSS', function () {
    return src('src/css/*.css')
        .pipe(cleanCSS())
        .pipe(rev())
        .pipe(dest('public/css'))
        .pipe(rev.manifest())
        .pipe(dest('public/css'));
});

task('manifest', function () {
    return src(['public/js/*.json', 'public/css/*.json'])
        .pipe(extend('rev-manifest.json'))
        .pipe(dest('public'));
});

task('rewrite', function (done) {
    const manifest = readFileSync('public/rev-manifest.json');

    src('src/**/*.html')
        .pipe(revRewrite({
            manifest
        }))
        .pipe(dest('public'));
    done();
});

task('copyFiles', function (done) {
    src('src/assets/**/*').pipe(dest('public/assets'));
    src('src/img/**/*').pipe(dest('public/img'));
    src('src/vendor/**/*').pipe(dest('public/vendor'));

    src(['src/*.png', 'src/*.json', 'src/*.js', 'src/*.txt']).pipe(dest('public'));

    done();
});

task('deployFirebase', function (done) {
    setTimeout(() => {
        runCommand('echo "Hello World!"');
        done();
    }, 3000);
});

task('postdeployFirebase', function (done) {
    src('./firebase.json')
        .pipe(jeditor(function (json) {
            json.hosting.public = 'src';
            return json; // must return JSON object.
        }))
        .pipe(dest("./"));
    done();
});

const predeployFirebase = task('predeployFirebase');
const clean = task('clean');
const minifyJS = task('minifyJS');
const minifyCSS = task('minifyCSS');
const manifest = task('manifest');
const rewrite = task('rewrite');
const copyFiles = task('copyFiles');
const deployFirebase = task('deployFirebase');
const postdeployFirebase = task('postdeployFirebase');

exports.default = series(
    predeployFirebase,
    clean,
    minifyJS,
    minifyCSS,
    manifest,
    rewrite,
    copyFiles,
    deployFirebase,
    postdeployFirebase
);