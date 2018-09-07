const fs = require('fs');
const Leven = require('levenshtein');

const IMG_FILENAME = require('../fix').IMG_FILENAME;

let db;

let cleanTitle = '';

function getInformation(currMasterId) {
	return new Promise((resolve, reject) => {
		db.getMaster(currMasterId, (err, masterRelease) => {
			if (err) {
				return reject(err)
			}

			parseInfo(masterRelease)
				.then(resolve)
				.catch(reject)
		});
	})
}

function loadImage(url) {
	return new Promise((resolve, reject) => {
		db.getImage(url, function(err, data, rateLimit){
			if(err){
				return reject(err)
			}

			fs.writeFile(IMG_FILENAME, data, 'binary', function (err) {
				if(err){
					return reject(err)
				}

				resolve(IMG_FILENAME)
			});
		});
	})
}

async function parseInfo(currMasterRelease) {
	const t = currMasterRelease;

	const song = getSongTitle(currMasterRelease);
	const artist = t.artists[0].name || '';

	const tags = {};
	if(song.title){
		tags.title = song.title;
		tags.originalTitle = song.title;
	}


	if(currMasterRelease.images[0].resource_url){
		tags.image = await loadImage(currMasterRelease.images[0].resource_url);
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

	return tags;
}

function getSongTitle(currMasterRelease) {
	if(currMasterRelease.tracklist && currMasterRelease.tracklist.length > 0){
		let dist = 10000;
		const ans = {title: '', position: 0};

		currMasterRelease.tracklist.forEach(({title, position}) => {
			const currentDist = (new Leven(cleanTitle, title)).distance;
			if(currentDist < dist){
				dist = currentDist;
				ans.title = title || '';
				ans.position = position || 0;
			}
		});

		return ans;
	}
}


class Discogs {
	constructor() {
		if(typeof db === "undefined"){
			const DisConnectClient = require('disconnect').Client;
			db = new DisConnectClient({
				consumerKey: 'WIqEZEIdMlfLsXGkWkKn',
				consumerSecret: 'YeDwBlkyXEtNjIYJOGuFSfZfjmywPmsF'
			}).database();
		}
	}

	find(artist, title) {
		return new Promise((resolve, reject) => {
			cleanTitle = `${title} - ${artist}`;
			db.search(cleanTitle, {type:'master'}, (err, data) => {
				if (err) {
					return reject(err);
				}

				if(data.results && data.results.length > 0 && data.results[0].id){
					const currSearchResult = data.results[0];
					//const imgURL = currSearchResult.thumb || null;
					getInformation(currSearchResult.id)
						.then(resolve)
						.catch(reject)
				}
				else{
					reject('We could not find any data for that song.')
				}
			});
		})
	}
}

module.exports = Discogs;
