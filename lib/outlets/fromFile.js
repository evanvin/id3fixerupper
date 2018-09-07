class FromFile {
	find({artist, title}) {
		return {
			title,
			originalTitle: title,
			artist,
			originalArtist: artist,
			performerInfo: artist,
		}
	}
}

module.exports = FromFile;
