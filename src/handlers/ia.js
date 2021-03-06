module.exports = (function() {
  var fs = require("fs"),
      utils = require("../utils");

  var directories = [
    ".",
    "images",
    "images/original",
    "images/thumbnail",
    "images/small",
    "images/medium",
    "images/medium800",
    "images/large",
    "images/square",
    "images/square/small",
    "images/square/medium",
    "ia",
    "ia/photos",
    "ia/photos/comments",
    "ia/photos/contexts",
    "ia/photosets",
    "ia/collections"
  ];

  /**
   * Ensure that all directories that are necessary, exist
   */
  function ensureDirectories(location) {
    utils.mkdir(location);

    var dirs = directories.map(function(dir) {
      dir = location + "/" + dir;
      utils.mkdir(dir);
      return dir;
    });

    // structured directories object
    return {
      dirs: dirs,
      root: dirs[0],
      images: {
        root: dirs[1],
        original: dirs[2],
        thumbnail: dirs[3],
        small: dirs[4],
        medium: dirs[5],
        medium800: dirs[6],
        large: dirs[7],
        square: {
          root: dirs[8],
          small: dirs[9],
          medium: dirs[10]
        }
      },
      ia: {
        root: dirs[11],
        photos: {
          root: dirs[12],
          comments: dirs[13],
          contexts: dirs[14]
        },
        photosets: dirs[15],
        collections: dirs[16]
      },
      flickr: {
        root: utils.mkdir("data/flickr"),
        methods: utils.mkdir("data/flickr/methods")
      }
    };
  }

  /**
   * Read all content from a directory
   */
  function readAll(dir, keyproperty, comparator) {
    var files = fs.readdirSync(dir),
        items = {},
        stats,
        filePath;
    files.forEach(function(file) {
      filePath = dir + "/" + file;
      stats = fs.statSync(filePath);
      if(stats.isFile()) {
        if(stats.size === 0) {
          return fs.unlinkSync(filePath);
        }
        try {
          var fileData = fs.readFileSync(filePath);
          item = JSON.parse(fileData);
          if(keyproperty) {
            items[item[keyproperty]] = item;
          } else {
            items[file.replace(".json", '')] = item;
          }
        } catch (e) {
          console.error("file: " + filePath);
          console.error("file data: " + fileData);
          throw e;
        }
      }
    });
    var keys = Object.keys(items);
    if(comparator) {
      keys = keys.sort(function(a,b) {
        return comparator(a,b,items);
      });
    }
    return {
      keys: keys,
      data: items
    };
  }

  // Cross-reference the various data sets, if there is data
  function crossReference(dirstructure, photos, photosets, collections) {
    if(!photos.keys) return;

    // hook up photo comments and contexts
    var comments = readAll(dirstructure.ia.photos.comments);
    var contexts = readAll(dirstructure.ia.photos.contexts);
    photos.keys.forEach(function(id) {
      var photo = photos.data[id];
      if (comments.data[id]) {
        photos.data[id].comments = comments.data[id].comment;
      }
      if (contexts.data[id]) {
        photos.data[id].contexts = contexts.data[id];
      }
    });

    // crosslink photos and sets
    if(photosets.keys) {
      photosets.keys.forEach(function(key) {
        var set = photosets.data[key];
        if(set.photos) {
          set.photos = set.photos.sort(function(a,b) {
            if (!photos.data[a] || !photos.data[b]) {
              return 0;
            }
            return photos.data[a].dates.posted - photos.data[b].dates.posted;
          });
          set.photos.forEach(function(id) {
            var photo = photos.data[id];
            if(!photo) {
              return;
            }
            if(!photo.sets) {
              photo.sets = [];
            }
            var idx = set.photos.indexOf(id),
                prev = (idx > 0 ? photos.data[set.photos[idx-1]] : false),
                next = (idx < set.photos.length-1 ? photos.data[set.photos[idx+1]] : false);
            photo.sets.push({
              id: set.id,
              prev: prev,
              next: next
            });
          });
        }
      });
    }
  }

  /**
   * I.A. builder
   */
  return function(location) {
    var dirstructure = ensureDirectories(location);

    // photos are ranked by publication date
    var photos = readAll(dirstructure.ia.photos.root, "id", function(a,b,items) {
      return items[b].dates.posted - items[a].dates.posted;
    });
    // sets are ranked by creation date
    var photosets = readAll(dirstructure.ia.photosets, "id", function(a,b,items) {
      return items[b].date_create - items[a].date_create;
    });
    // collections are sorted alphabetically
    var collections = readAll(dirstructure.ia.collections, "id", function(a,b,items) {
      a = items[a].title;
      b = items[b].title;
      return a === b ? 0 : b < a ? -1 : -1;
    });

    // perform cross-referencing
    crossReference(dirstructure, photos, photosets, collections);

    // our final IA object
    return {
      // photos
      photos: photos.data,
      photo_keys: photos.keys,
      // sets
      photosets: photosets.data,
      photoset_keys: photosets.keys,
      // collections
      collections: collections.data,
      collection_keys: collections.keys,
      // dir adminstration
      dirstructure: dirstructure
    };
  };
}());
