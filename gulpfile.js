var gulp = require('gulp');
var zip = require('gulp-zip');
var replace = require('gulp-replace');
var bump = require('gulp-bump');
var semver = require('semver');

var request = require('request');
var fs = require('fs');
var cp = require('child_process');
var del = require('del');

var config = require('./config.json');

gulp.task('clean', () => {
    var destFolder = config.addon.dist + config.addon.packagename;
    return del([destFolder]);
});

var getPackageJson = function () {
    return JSON.parse(fs.readFileSync('./package.json', 'utf8'));
};

gulp.task('semver-patch', (bc) => {
    console.log('Semver patching');
    config.addon.semver = 'patch';
    return bc();
});

gulp.task('semver-minor', (bc) => {
    console.log('Semver minor');
    config.addon.semver = 'minor';
    return bc();
});

gulp.task('getVersion', (bc) => {

    var pkg = getPackageJson();
    config.version = pkg.version;

    if (config.addon.semver !== '' && config.addon.semver.length > 0) {
        config.version = semver.inc(pkg.version, config.addon.semver);
    }
    console.log('Version package ' + config.version);
    return bc();
});

gulp.task('updateVersionInPackageFile', () => {
    
    return gulp.src('./package.json', { base: './' })
        .pipe(bump({ version: config.version }))
        .pipe(gulp.dest('./'));
});

gulp.task('updateVersionInAddonXml', () => {
    
    var destFolder = config.addon.dist + config.addon.packagename +'/';
    return gulp.src(config.addon.src + 'addon.xml', {base : config.addon.src })
        .pipe(replace("__VERSION__", config.version))
        .pipe(gulp.dest(destFolder));
  });

gulp.task('copyFiles', () => {

    var destFolder = config.addon.dist + config.addon.packagename;

    return gulp.src([
            config.addon.src + '/**/*.*',
            '!' + config.addon.src + '/test/**/*.*',
            '!' + config.addon.src + '/addon.xml'
        ], {base: config.addon.src})
        .pipe(gulp.dest(destFolder));
});

gulp.task('devCopyFiles', () => {

    var destFolder = config.addon.dist + config.addon.packagename;

    return gulp.src([
            config.addon.src + '/**/*.*',
            '!' + config.addon.src + '/test/**/*.*',
            '!' + config.addon.src + '/addon.xml'
        ], {base: config.addon.src})
        .pipe(gulp.dest(destFolder));
});

gulp.task('createPackage', () => {
    
    var zipFileName = config.addon.packagename + '-' + config.version + '.zip';
    console.log('Creating package ' + zipFileName);

    return gulp.src(config.addon.dist + '/' + config.addon.packagename + '/**', {base : config.addon.dist })
        .pipe(zip(zipFileName))
        .pipe(gulp.dest(config.addon.zip_destination));
});

gulp.task('cleanInKodi', () => {
    var kodiFolder = config.kodi.addons_directory + '\\' + config.addon.packagename;
    return del([
        kodiFolder + '\\**\\*.*',
        '!' + kodiFolder + '\\',
        '!' + kodiFolder + '\\media\\',
        '!' + kodiFolder + '\\media\\*.xbt'
    ], { force: true });
});

gulp.task('copyFilesToKodi', () => {
    
    var kodiFolder = config.kodi.addons_directory + '\\' + config.addon.packagename;
    var distPackageFolder = config.addon.dist + "/" + config.addon.packagename;

    return gulp.src([
        distPackageFolder + '/**',
        '!' + distPackageFolder + '/**/*.xbt'
        ], { base: distPackageFolder })
        .pipe(gulp.dest(kodiFolder, { force: true }));
});

gulp.task('reload-kodi-skin', (bc) => {
       
    var auth = '';
    if (config.kodi.user !== '') {
        auth = auth + config.kodi.user;
    }
    if (config.kodi.password !== '') {
        auth = auth + ':' + config.kodi.password;
    }
    if (auth !== '') {
        auth = auth + '@';
    }

    var url = 'http://' + auth + config.kodi.host + ':' + config.kodi.port + '/jsonrpc';
    var body = JSON.stringify({ "jsonrpc": "2.0", "id": 1, "method": "Addons.ExecuteAddon", "params": { "addonid": "script.toolbox", "params": { "info": "builtin", "id": "ReloadSkin()" } } });

    var post_options = {
        url: url,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'  
        },
        body: body
    };

    request.post(post_options, function (error, response, rbody) {
        if (error) {
          return console.error('POST failed:', error);
        }
        console.log('POST successful!  Server responded with:', rbody);
      });
    
    return bc();
});

gulp.task('setVersion', gulp.parallel('updateVersionInPackageFile', 'updateVersionInAddonXml'));
gulp.task('semver-up', gulp.series('getVersion', 'setVersion'));
gulp.task('prebuild', gulp.series('clean', 'copyFiles'));

gulp.task('publish-to-kodi', gulp.series('cleanInKodi', 'copyFilesToKodi', 'reload-kodi-skin'));
gulp.task('publish', gulp.series('prebuild', 'semver-up', 'publish-to-kodi'));

gulp.task('build', gulp.series('prebuild', 'semver-up', 'createPackage'));
gulp.task('build-minor', gulp.series('semver-minor', 'build'));
gulp.task('build-patch', gulp.series('semver-patch', 'build'));

gulp.task('build-publish', gulp.series('build', 'publish-to-kodi'));
gulp.task('build-publish-minor', gulp.series('build-minor', 'publish-to-kodi'));
gulp.task('build-publish-patch', gulp.series('build-patch', 'publish-to-kodi'));

gulp.task('default', gulp.series('build'), function () { });
