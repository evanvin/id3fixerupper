const fs = require('fs');
const inquirer = require('inquirer');
const NodeID3 = require('node-id3');
const chalk = require('chalk');
const getArtistTitle = require('get-artist-title');

const DisConnectWrapper = require('./outlets/discogs');

const IMG_FILENAME = 'tmp.jpg';
const ENCODED_BY = 'https://github.com/evanvin';

let isMultiple = false;
let multipleIndex = 0;
let multipleFiles;

let currFile;
let currTags = {};

let needFillTagsFromFileName = false;


module.exports = {
	fixSingle(){
		resetVariables();
		isMultiple = false;
		fs.readdir('./', (err, files) => {
			inquirer.prompt([
			{
				type: 'list',
				name: 'file',
				message: 'What file would you like to fix up?',
				choices: files
			}
			]).then(choice => {
				doFix(choice['file']);
			});

		})
	},

	fixMultiple(){
		resetVariables();
		isMultiple = true;
		fs.readdir('./', (err, files) => {
			multipleFiles = files;
			doFix(multipleFiles[multipleIndex]);
		});
	},
	setSearchOptions(options){
		if (options.hasOwnProperty('needFillTagsFromFileName')) {
			needFillTagsFromFileName = true;
		}
	},
	IMG_FILENAME
};

function doFix(file){
	if(file && file.split('.').pop() === 'mp3'){
		currFile = file;
		currTags = getCurrentID3(file);
		if(currTags.encodedBy !== ENCODED_BY){
			const dcw = new DisConnectWrapper();
			dcw.find(currTags.artist, currTags.title)
				.then(fillTags)
				.catch(e => {
					console.log(chalk.red(e));
					if(needFillTagsFromFileName){
						console.log(chalk.yellow('Tag filled from filename' + file));
						const FromFile = require('./outlets/fromFile');
						const tags = (new FromFile).find(currTags);
						fillTags(tags)
					} else {
						goNext();
					}
				});
		}
		else{
			console.log(chalk.yellow(file + ' has already been fixed!'));
			goNext();
		}
	}
	else{
		goNext();
	}
}

function fillTags(fetchedTags){
	fetchedTags.encodedBy = ENCODED_BY;

	Object.assign(currTags, fetchedTags);

	NodeID3.write(currTags, currFile, err => {
		if(err){
			console.log(chalk.red(err));
		}

		deleteImage(goNext)
	});
}

function deleteImage(nextCb){
	//check if image exists and then delete
	fs.exists(IMG_FILENAME, exists => {
		if(exists){
			fs.unlinkSync(IMG_FILENAME);
		}
		nextCb();
	});
}

function getCurrentID3(file){
	const tags = NodeID3.read(file) || {};

	if (!tags.artist || !tags.title) {
		const res = getArtistTitle(file);
		const map = {
			artist: 0,
			title: 1,
		};

		for (const index in map) {
			if (!tags[index]) {
				tags[index] = res[map[index]]
			}
		}
	}

	return tags;
}

function goNext(){
	if(isMultiple && multipleIndex+1 < multipleFiles.length ){
		doFix(multipleFiles[++multipleIndex]);
	}
}

function resetVariables(){
	multipleIndex = 0;
	multipleFiles = null;
}
