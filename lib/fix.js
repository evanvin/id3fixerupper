var fs  = require('fs');
var inquirer    = require('inquirer');
var NodeID3 = require('node-id3');
var chalk       = require('chalk');
var getArtistTitle = require('get-artist-title');
var Leven = require('levenshtein');

const Discogs = require('disconnect').Client;

const db = new Discogs({
	consumerKey: 'WIqEZEIdMlfLsXGkWkKn', 
	consumerSecret: 'YeDwBlkyXEtNjIYJOGuFSfZfjmywPmsF'
}).database();

const IMG_FILENAME = 'tmp.jpg';
const NA = '';
const ENCODED_BY = 'https://github.com/evanvin';

var isMultiple = false;
var multipleIndex = 0;
var multipleFiles;

var currFile;
var currID3;
var currTags;

var currMasterId;
var currMasterRelease;
var currSearchResult = {};

let needFillTagsFromFileName = false;
let hasImage = false;
let hasTags = false;


module.exports = {
	fixSingle(){
		resetVariables();
		isMultiple = false;
		fs.readdir('./', function(err, files){
			inquirer.prompt([
			{
				type: 'list',
				name: 'file',
				message: 'What file would you like to fix up?',
				choices: files
			}
			]).then(function (choice) {
				doFix(choice['file']);
			});

		})
	},

	fixMultiple(){
		resetVariables();
		isMultiple = true;
		fs.readdir('./', function(err, files){
			multipleFiles = files;
			doFix(multipleFiles[multipleIndex]);
		});
	},
	setSearchOptions(options){
		if (options.hasOwnProperty('needFillTagsFromFileName')) {
			needFillTagsFromFileName = true;
		}
	}
};



function doFix(file){
	if(file && file.split('.').pop() === 'mp3'){
		currFile = file;
		currID3 = getCurrentID3(file);
		if(currID3 !== ENCODED_BY){
			db.search(currID3, {type:'master'}, searchResults);
		}
		else{
			console.log(chalk.yellow(file + ' has already been fixed!'));
			goNext();
		}
	}
	else{
		goNext();
	}

	function searchResults(err, data){
		if(data && data.results && data.results.length > 0){
			currSearchResult = data.results[0];
			if(currSearchResult.id){
				currMasterId = currSearchResult.id;
				var imgURL = currSearchResult.thumb || null;
				getInformation();
			}
			else{
				noSearchDataFound();
			}
		}
		else{
			noSearchDataFound();
		}

		function noSearchDataFound(){
			console.log(chalk.red('We could not find any data for that song.'));
			if(needFillTagsFromFileName){
				checkTitleInfo();
			}
		}
	}

	function checkTitleInfo(){
		if(hasTags){
			console.log(chalk.yellow('File ' + file + ' already has tags'));
			goNext();
		}
		else{
			console.log(chalk.yellow('Tag filled from filename' + file));
			currSearchResult = {};
			const parts = currID3.split(' - ');
			currMasterRelease = {
				artists: [{name: parts[1]}],
				genres: [],
				title: parts[0]
			};
			fillTags();
		}
	}
}

function getInformation(){
	db.getMaster(currMasterId, saveImage);
}

function saveImage(err, masterRelease){
	currMasterRelease = masterRelease;
	if(currMasterRelease){
		if(currMasterRelease.images[0].resource_url){
			db.getImage(currMasterRelease.images[0].resource_url, function(err, data, rateLimit){
				if(err){
					console.log(chalk.red(err));
					fillTags()
				}
				else{
					fs.writeFile(IMG_FILENAME, data, 'binary', function (err) {
						if(err){
							console.log(chalk.red(err));
						}

						fillTags()
					});
				}
			});
		}
		else{
			fillTags();
		}
	}
	else{
		console.log(chalk.red('No master release was found for that song.'));
		goNext();
	}
}



function fillTags(){
	const t = currMasterRelease;

	var song = getSongTitle();
	var artist = t.artists[0].name || NA;

	let tags = currTags || {};
	if(song.title){
		tags.title = song.title;
		tags.originalTitle = song.title;
	}

	if(hasImage){
		tags.image = IMG_FILENAME;
		hasImage = false;
	}

	if(song.position){
		tags.trackNumber = song.position;
	}

	if(t.year){
		tags.year = t.year;
	}

	if(t.title){
		tags.album = t.title;
	}

	if(artist){
		tags.originalArtist = artist;
		tags.artist = artist;
		tags.performerInfo = artist;
	}

	if(t.genres.join(', ')){
		tags.genre = t.genres.join(', ');
	}

	if(t.notes){
		tags.comment = t.notes;
	}

	tags.encodedBy = ENCODED_BY;

	currTags = tags;

	NodeID3.write(currTags, currFile, err => {
		if(err){
			console.log(chalk.red(err));
		}

		deleteImage(goNext)
	});
}

function deleteImage(nextCb){
	//check if image exists and then delete
	fs.exists(IMG_FILENAME, function (exists) {
		if(exists){
			fs.unlinkSync(IMG_FILENAME);
		}
		nextCb();
	});
}

function getSongTitle(){
	if(currMasterRelease.tracklist && currMasterRelease.tracklist.length > 0){
		var ans = {dist: 10000, title:'', position: 0};
		currMasterRelease.tracklist.forEach(function(track) {
			var l = new Leven(currFile, track.title).distance;
			if(l < ans.dist){
				ans.dist = l;
				ans.title = track.title || '';
				ans.position = track.position || '';
			}
		});
		return ans;
	}
	else{
		return {dist: 100000, title: currSearchResult.title || currMasterRelease.title || NA, position : 0};
	}
}

function getCurrentID3(file){
	const tags = NodeID3.read(file);
	if(tags){
		currTags = tags;
		if(tags.encodedBy === ENCODED_BY){
			return ENCODED_BY;
		}
		else if(tags.title){
			hasTags = true;
			return tags.title + ' - ' + tags.artist;
		}
	}
	file = getArtistTitle(file);
	return file[1] + ' - ' + file[0];
}

function goNext(){
	hasTags = false;
	if(isMultiple && multipleIndex+1 < multipleFiles.length ){
		doFix(multipleFiles[++multipleIndex]);
	}
}

function resetVariables(){
	multipleIndex = 0;
	multipleFiles = null;
	currTags = null;
	currMasterId = null;
	currMasterRelease = null;
	currSearchResult = {};
	hasImage = false;
	hasTags = false;
}
