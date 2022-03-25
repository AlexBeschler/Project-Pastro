/*jshint esversion: 8 */
const { src, dest, task } = require('gulp');
const { series } = require('gulp');
const minify = require('gulp-minify');
const cleanCSS = require('gulp-clean-css');

task('minifyJS', function (done) {
    src('src/js/*.js').pipe(minify({noSource: true, ext:{min:'.js'}})).pipe(dest('public/js'));
    done();
});

task('minifyCSS', function (done) {
    src('src/css/*.css').pipe(cleanCSS()).pipe(dest('public/css'));
    done();
});

task('copyFiles', function (done) {
    src('src/assets/**/*').pipe(dest('public/assets'));
    src('src/img/**/*').pipe(dest('public/img'));
    src('src/vendor/**/*').pipe(dest('public/vendor'));

    src(['src/*.html', 'src/*.ico', 'src/*.json', 'src/*.js', 'src/*.txt']).pipe(dest('public'));

    done();
});

const minifyJS = task('minifyJS');
const minifyCSS = task('minifyCSS');
const copyFiles = task('copyFiles');

exports.default = series(minifyJS, minifyCSS, copyFiles);