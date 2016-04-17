var gulp = require('gulp')
var typescript = require('gulp-typescript')
var mocha = require('gulp-mocha')

var tsproject = typescript.createProject('./tsconfig.json')

gulp.task('default', function(){

  gulp.src('./src/*.ts')
  .pipe(typescript(tsproject))
  .pipe(gulp.dest('./bin'))
  .pipe(mocha())



})
