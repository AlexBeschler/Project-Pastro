const { src, dest, task } = require('gulp');
const minify = require('gulp-minify');
const imagemin = require('gulp-imagemin');
const cleanCSS = require('gulp-clean-css');

task('minifyJS', function (done) {
    src('src/js/*.js').pipe(minify({noSource: true, ext:{min:'.js'}})).pipe(dest('public/js'));
    done();
});

task('minifyCSS', function (done) {
    src('src/css/*.css').pipe(cleanCSS()).pipe(dest('public/css'));
    done();
});

task('minifyImages', function (done) {
    src('src/assets/*.+(png|jpg|gif|svg)').pipe(imagemin()).pipe(dest('public/assets'));
    done();
});