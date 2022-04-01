/*jshint esversion: 8 */
const {
    src,
    dest,
    task
} = require('gulp');
const {
    series
} = require('gulp');
const rev = require('gulp-rev');
const revRewrite = require('gulp-rev-rewrite');
const minify = require('gulp-minify');
const cleanCSS = require('gulp-clean-css');


/**** Tasks ****/

task('minifyJS', function (done) {
    src('src/js/*.js').pipe(minify({
        noSource: true,
        ext: {
            min: '.js'
        }
    })).pipe(dest('public/js'));
    done();
});

task('minifyCSS', function (done) {
    src('src/css/*.css').pipe(cleanCSS()).pipe(dest('public/css'));
    done();
});

task('revision', function (done) {
    src('src/**/*.{css,js}')
        .pipe(rev())
        .pipe(src('src/**/*.html'))
        .pipe(revRewrite())
        .pipe(dest('public'));
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
const revision = task('revision');

exports.default = series(minifyJS, minifyCSS, copyFiles);