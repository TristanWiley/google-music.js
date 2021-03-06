// Load in dependencies
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');

// Define selector constants
var SELECTORS = {
  info: {
    albumArtId: 'playerBarArt',
    albumSelector: '.player-album',
    artistId: 'player-artist',
    containerId: 'playerSongInfo',
    infoWrapperClass: 'now-playing-info-wrapper',
    titleId: 'currently-playing-title'
  },
  forward: {
    buttonSelector: '[data-id="forward"]'
  },
  playPause: {
    buttonSelector: '[data-id="play-pause"]',
    dataId: 'play-pause',
    playingClass: 'playing'
  },
  rating: {
    // DEV: `.player-rating-container` doesn't exist until a song is playing
    containerSelector: '#playerSongInfo',
    thumbsSelector: '#player .player-rating-container [icon^="sj:thumb-"][data-rating]',
    thumbsUpSelector: '#player .player-rating-container [icon^="sj:thumb-"][data-rating="5"]',
    thumbsDownSelector: '#player .player-rating-container [icon^="sj:thumb-"][data-rating="1"]',
    thumbSelectorFormat: '#player .player-rating-container [icon^="sj:thumb-"][data-rating="{rating}"]'
  },
  repeat: {
    dataId: 'repeat',
    buttonSelector: '[data-id="repeat"]'
  },
  rewind: {
    buttonSelector: '[data-id="rewind"]'
  },
  shuffle: {
    dataId: 'shuffle',
    buttonSelector: '[data-id="shuffle"]'
  },
  playback: {
    sliderId: 'material-player-progress'
  },
  volume: {
    sliderId: 'material-vslider'
  }
};

// Define bind method
function bind(context, fn) {
  return function bindFn () {
    return fn.apply(context, arguments);
  };
}

// Define our constructor
function GoogleMusic(win) {
  // If win was not provided, complain
  if (!win) {
    throw new Error('`win` was not provided to the `GoogleMusic` constructor');
  }

  // Inherit from EventEmitter
  EventEmitter.call(this);

  // Localize reference to window and document
  this.win = win;
  this.doc = win.document;

  // For each of the prototype sections
  var proto = GoogleMusic._protoObj;
  for (var protoKey in proto) {
    if (proto.hasOwnProperty(protoKey)) {
      // Define a key on our object
      this[protoKey] = {};

      // For each of the keys on the section, define a function that invokes on this original context
      var section = proto[protoKey];
      for (var sectionKey in section) {
        if (section.hasOwnProperty(sectionKey)) {
          this[protoKey][sectionKey] = bind(this, section[sectionKey]);
        }
      }

      // If there was an `init` method, run it
      if (this[protoKey].init) {
        this[protoKey].init();
      }
    }
  }
}
// Inherit from EventEmitter normally
inherits(GoogleMusic, EventEmitter);

// Define a "prototype" that will have magical invocation
var proto = GoogleMusic._protoObj = {};

// Create a volume API
proto.volume = {
  // Query required elements
  init: function () {
    this.volume._sliderEl = this.doc.getElementById(SELECTORS.volume.sliderId);
    assert(this.volume._sliderEl, 'Failed to find slider element for volume "#' + SELECTORS.volume.sliderId + '"');
  },

  // Get the current volume level.
  getVolume: function () {
    return parseInt(this.volume._sliderEl.getAttribute('aria-valuenow'), 10);
  },

  // Set the volume level (0 - 100).
  setVolume: function (vol) {
    var current = this.volume.getVolume();

    if (vol > current) {
      this.volume.increaseVolume(vol - current);
    } else if (vol < current) {
      this.volume.decreaseVolume(current - vol);
    }
  },

  // Increase the volume by an amount (default of 5)
  increaseVolume: function (amount) {
    if (amount === undefined) {
      amount = 5;
    }

    for (var i = 0; i < amount; i += 5) {
      this.volume._sliderEl.increment();
    }
  },

  // Decrease the volume by an amount (default of 5)
  decreaseVolume: function (amount) {
    if (amount === undefined) {
      amount = 5;
    }

    for (var i = 0; i < amount; i += 5) {
      this.volume._sliderEl.decrement();
    }
  }
};

// Create a playback API and constants
GoogleMusic.Playback = {
  // Playback states
  STOPPED: 0,
  PAUSED: 1,
  PLAYING: 2,

  // Repeat modes
  LIST_REPEAT: 'LIST_REPEAT',
  SINGLE_REPEAT: 'SINGLE_REPEAT',
  NO_REPEAT: 'NO_REPEAT',

  // Shuffle modes
  ALL_SHUFFLE: 'ALL_SHUFFLE',
  NO_SHUFFLE: 'NO_SHUFFLE'
};
GoogleMusic.Playback.SHUFFLE_MODES = [
    GoogleMusic.Playback.ALL_SHUFFLE,
    GoogleMusic.Playback.NO_SHUFFLE
];
GoogleMusic.Playback.REPEAT_MODES = [
  GoogleMusic.Playback.LIST_REPEAT,
  GoogleMusic.Playback.SINGLE_REPEAT,
  GoogleMusic.Playback.NO_REPEAT
];
proto.playback = {
  // Query references to the media playback elements
  init: function () {
    var _sliderEl = this.playback._sliderEl = this.doc.getElementById(SELECTORS.playback.sliderId);
    var _playPauseEl = this.playback._playPauseEl = this.doc.querySelector(SELECTORS.playPause.buttonSelector);
    var _forwardEl = this.playback._forwardEl = this.doc.querySelector(SELECTORS.forward.buttonSelector);
    var _rewindEl = this.playback._rewindEl = this.doc.querySelector(SELECTORS.rewind.buttonSelector);
    var _shuffleEl = this.playback._shuffleEl = this.doc.querySelector(SELECTORS.shuffle.buttonSelector);
    var _repeatEl = this.playback._repeatEl = this.doc.querySelector(SELECTORS.repeat.buttonSelector);

    assert(_sliderEl, 'Failed to find slider element for playback "#' + SELECTORS.playback.sliderId + '"');
    assert(_playPauseEl, 'Failed to find playPause element for playback "' + SELECTORS.playPause.buttonSelector + '"');
    assert(_forwardEl, 'Failed to find forward element for playback "' + SELECTORS.forward.buttonSelector + '"');
    assert(_rewindEl, 'Failed to find rewind element for playback "' + SELECTORS.rewind.buttonSelector + '"');
    assert(_shuffleEl, 'Failed to find shuffle element for playback "' + SELECTORS.shuffle.buttonSelector + '"');
    assert(_repeatEl, 'Failed to find repeat element for playback "' + SELECTORS.repeat.buttonSelector + '"');
  },

  // Time functions
  getPlaybackTime: function () {
    return parseInt(this.playback._sliderEl.getAttribute('aria-valuenow'), 10);
  },

  setPlaybackTime: function (milliseconds) {
    // Set playback value on the element and trigger a change event
    this.playback._sliderEl.value = milliseconds;
    var evt = new this.win.UIEvent('change');
    this.playback._sliderEl.dispatchEvent(evt);
  },

  getPlaybackState: function () {
    // Play/Pause element states:
    //   PLAYING: {__data__: {icon: 'av:pause-circle-filled'}, disabled: false}
    //   PAUSED: {__data__: {icon: 'av:sj:pause-circle-fill'}, disabled: false}
    //   STOPPED: {__data__: {icon: 'av:sj:play-circle-fill'}, disabled: true}
    if (!this.playback._playPauseEl.disabled) {
      if (this.playback._playPauseEl.__data__.icon === 'av:pause-circle-filled') {
        return GoogleMusic.Playback.PLAYING;
      } else {
        return GoogleMusic.Playback.PAUSED;
      }
    } else {
      return GoogleMusic.Playback.STOPPED;
    }
  },

  getSongInfo: function () {
    var songInfo = {
      title: this.doc.getElementById(SELECTORS.info.titleId).textContent || 'Unknown',
      artist: this.doc.getElementById(SELECTORS.info.artistId).textContent || 'Unknown',
      album: this.doc.querySelector(SELECTORS.info.albumSelector).textContent || 'Unknown',
      art: this.doc.getElementById(SELECTORS.info.albumArtId) || null,
      duration: this.doc.getElementById(SELECTORS.playback.sliderId).max
    };
    songInfo.art = (songInfo.art) ? songInfo.art.src : null;

    // The art may be a protocol-relative URL, so normalize it to HTTPS
    if (songInfo.art && songInfo.art.slice(0, 2) === '//') {
      songInfo.art = 'https:' + songInfo.art;
    }
    return songInfo;
  },

  // Playback functions
  playPause: function () { this.playback._playPauseEl.click(); },
  forward: function () { this.playback._forwardEl.click(); },
  rewind: function () { this.playback._rewindEl.click(); },

  getShuffle: function () {
    if (this.playback._shuffleEl.classList.contains('active')) {
      return GoogleMusic.Playback.ALL_SHUFFLE;
    } else {
      return GoogleMusic.Playback.NO_SHUFFLE;
    }
  },
  setShuffle: function (mode) {
    assert(GoogleMusic.Playback.SHUFFLE_MODES.indexOf(mode) !== -1,
      'Expected shuffle mode "' + mode + '" to be inside ' +
      JSON.stringify(GoogleMusic.Playback.SHUFFLE_MODES) + ' but it wasn\'t');
    while (this.playback.getShuffle() !== mode) {
      this.playback.toggleShuffle();
    }
  },
  toggleShuffle: function () { this.playback._shuffleEl.click(); },

  getRepeat: function () {
    // Repeat element states:
    //   SINGLE_REPEAT: {classList: ['active'], __data__: {icon: 'av:repeat-one'}}
    //   LIST_REPEAT: {classList: ['active'], __data__: {icon: 'av:repeat'}}
    //   NO_REPEAT: {classList: [], __data__: {icon: 'av:repeat'}}
    if (this.playback._repeatEl.__data__.icon === 'av:repeat-one') {
      return GoogleMusic.Playback.SINGLE_REPEAT;
    } else if (this.playback._repeatEl.classList.contains('active')) {
      return GoogleMusic.Playback.LIST_REPEAT;
    } else {
      return GoogleMusic.Playback.NO_REPEAT;
    }
  },
  setRepeat: function (mode) {
    assert(GoogleMusic.Playback.REPEAT_MODES.indexOf(mode) !== -1,
      'Expected repeat mode "' + mode + '" to be inside ' +
      JSON.stringify(GoogleMusic.Playback.REPEAT_MODES) + ' but it wasn\'t');
    while (this.playback.getRepeat() !== mode) {
      this.playback.toggleRepeat();
    }
  },
  toggleRepeat: function () { this.playback._repeatEl.click(); },

  // Taken from the Google Play Music page
  toggleVisualization: function () {
    this.win.SJBpost('toggleVisualization');
  }
};

// Create a rating API
proto.rating = {
  // Determine if a thumb is selected or not
  _isElSelected: function (el) {
    // jscs:disable maximumLineLength
    // Unselected thumbs down:
    // <paper-icon-button icon="sj:thumb-up-outline" data-rating="5" role="button" tabindex="0" aria-disabled="false" class="x-scope paper-icon-button-0" title="Thumb-up" aria-label="Thumb-up"></paper-icon-button>
    //   el.__data__.icon = 'sj:thumb-down-outline';
    // Selected thumbs up:
    // <paper-icon-button icon="sj:thumb-up-outline" data-rating="5" role="button" tabindex="0" aria-disabled="false" class="x-scope paper-icon-button-0" title="Undo thumb-up" aria-label="Undo thumb-up"></paper-icon-button>
    //   el.__data__.icon = 'thumb-up';
    // jscs:enable maximumLineLength
    // DEV: We don't use English only strings (e.g. "Undo") to support i18n
    return el.__data__.icon === 'thumb-up' || el.__data__.icon === 'thumb-down';
  },
  // Get current rating
  getRating: function () {
    var thumbEls = this.doc.querySelectorAll(SELECTORS.rating.thumbsSelector);
    assert(thumbEls.length, 'Failed to find thumb elements for rating "' + SELECTORS.rating.thumbsSelector + '"');
    var i = 0;
    var len = thumbEls.length;
    for (; i < len; i++) {
      var el = thumbEls[i];
      if (this.rating._isElSelected(el)) {
        return el.dataset.rating;
      }
    }
    return '0';
  },

  // Thumbs up
  toggleThumbsUp: function () {
    var el = this.doc.querySelector(SELECTORS.rating.thumbsUpSelector);

    if (el) {
      el.click();
    }
  },

  // Thumbs down
  toggleThumbsDown: function () {
    var el = this.doc.querySelector(SELECTORS.rating.thumbsDownSelector);

    if (el) {
      el.click();
    }
  },

  // Set a rating
  setRating: function (rating) {
    var selector = SELECTORS.rating.thumbSelectorFormat.replace('{rating}', rating);
    var el = this.doc.querySelector(selector);

    if (el && !this.rating._isElSelected(el)) {
      el.click();
    }
  },

  // Reset the rating
  resetRating: function () {
    var selector = SELECTORS.rating.thumbSelectorFormat.replace('{rating}', this.rating.getRating());
    var el = this.doc.querySelector(selector);

    if (el && this.rating._isElSelected(el)) {
      el.click();
    }
  }
};

// Miscellaneous functions
proto.extras = {
  // Get a shareable URL of the song on Google Play Music
  getSongURL: function () {
    var albumEl = this.doc.querySelector('.player-album');
    var artistEl = this.doc.querySelector('.player-artist');

    var urlTemplate = 'https://play.google.com/music/m/';
    var url = null;

    var parseID = function (id) {
      return id.substring(0, id.indexOf('/'));
    };

    if (albumEl === null && artistEl === null) {
      return null;
    }

    var albumId = parseID(albumEl.dataset.id);
    var artistId = parseID(artistEl.dataset.id);

    if (albumId) {
      url = urlTemplate + albumId;
    } else if (artistId) {
      url = urlTemplate + artistId;
    }

    return url;
  }
};

proto.hooks = {
  init: function () {
    // Save context for bindings
    var that = this;

    // Define mutation observer for reuse
    var MutationObserver = this.win.MutationObserver || this.win.WebKitMutationObserver;

    var lastTitle = '';
    var lastArtist = '';
    var lastAlbum = '';

    var addObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        for (var i = 0; i < m.addedNodes.length; i++) {
          // DEV: We can encounter a text node, verify we have a `classList` to assert against
          var target = m.addedNodes[i];
          if (target.classList && target.classList.contains(SELECTORS.info.infoWrapperClass)) {
            var songInfo = that.playback.getSongInfo();
            // Make sure that this is the first of the notifications for the
            // insertion of the song information elements.
            if (lastTitle !== songInfo.title || lastArtist !== songInfo.artist || lastAlbum !== songInfo.album) {
              that.emit('change:song', songInfo);

              lastTitle = songInfo.title;
              lastArtist = songInfo.artist;
              lastAlbum = songInfo.album;
            }
          }
        }
      });
    });

    var lastShuffle;
    var shuffleObserver = new MutationObserver(function (mutations) {
      var shuffleTouched = mutations.some(function (m) {
        var target = m.target;
        return target.dataset.id === SELECTORS.shuffle.dataId;
      });

      if (!shuffleTouched) {
        return;
      }

      var newShuffle = that.playback.getShuffle();
      if (lastShuffle !== newShuffle) {
        lastShuffle = newShuffle;
        that.emit('change:shuffle', newShuffle);
      }
    });

    var lastRepeat;
    var repeatObserver = new MutationObserver(function (mutations) {
      var repeatTouched = mutations.some(function (m) {
        var target = m.target;
        return target.dataset.id === SELECTORS.repeat.dataId;
      });

      if (!repeatTouched) {
        return;
      }

      var newRepeat = that.playback.getRepeat();
      if (lastRepeat !== newRepeat) {
        lastRepeat = newRepeat;
        that.emit('change:repeat', newRepeat);
      }
    });

    var lastMode;
    var playbackObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        var target = m.target;
        var id = target.dataset.id;

        if (id === SELECTORS.playPause.dataId) {
          // If the play/pause button is disabled
          var mode;
          if (target.disabled === true) {
            // If there is song info, then we are transitioning songs and do nothing
            if (that.doc.getElementById(SELECTORS.info.containerId).style.display !== 'none') {
              return;
            // Otherwise, we are stopped
            } else {
              mode = GoogleMusic.Playback.STOPPED;
            }
          // Otherwise (the play/pause button is enabled)
          } else {
            var playing = target.classList.contains(SELECTORS.playPause.playingClass);
            if (playing) {
              mode = GoogleMusic.Playback.PLAYING;
            // DEV: If this fails to catch stopped cases, then maybe move "no song info" check to top level
            } else {
              mode = GoogleMusic.Playback.PAUSED;
            }
          }

          // If the mode has changed, then update it
          if (mode !== lastMode) {
            that.emit('change:playback', mode);
            lastMode = mode;
          }
        }
      });
    });

    var playbackTimeObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        var target = m.target;
        var id = target.id;

        if (id === SELECTORS.playback.sliderId) {
          var currentTime = parseInt(target.getAttribute('aria-valuenow'), 10);
          var totalTime = parseInt(target.getAttribute('aria-valuemax'), 10);
          that.emit('change:playback-time', {current: currentTime, total: totalTime});
        }
      });
    });

    var lastRating;
    var ratingObserver = new MutationObserver(function (mutations) {
      // If we are looking at a rating button and it's selected, emit a notification
      // DEV: Prevent selection of container and "remove-circle-outline" button
      // jscs:disable maximumLineLength
      // Good:
      //   <paper-icon-button icon="sj:thumb-up-outline" data-rating="5" role="button" tabindex="0" aria-disabled="false" class="x-scope paper-icon-button-0" title="Thumb-up" aria-label="Thumb-up"></paper-icon-button>
      // Bad:
      //   <div id="playerSongInfo" style=""></div>
      //   <paper-icon-button icon="remove-circle-outline" data-rating="0" role="button" tabindex="0" aria-disabled="false" class="x-scope paper-icon-button-0"></paper-icon-button>
      // jscs:enable maximumLineLength
      var ratingsTouched = mutations.some(function (m) {
        // Determine if our ratings were touched
        var target = m.target;
        return target.dataset && target.dataset.rating && target.hasAttribute('aria-label');
      });

      if (!ratingsTouched) {
        return;
      }

      var newRating = that.rating.getRating();
      if (lastRating !== newRating) {
        lastRating = newRating;
        that.emit('change:rating', newRating);
      }
    });

    // Find our target elements
    var addObserverEl = this.doc.getElementById(SELECTORS.info.containerId);
    var shuffleObserverEl = this.doc.querySelector(SELECTORS.shuffle.buttonSelector);
    var repeatObserverEl = this.doc.querySelector(SELECTORS.repeat.buttonSelector);
    var playbackObserverEl = this.doc.querySelector(SELECTORS.playPause.buttonSelector);
    var playbackTimeObserverEl = this.doc.getElementById(SELECTORS.playback.sliderId);
    var ratingObserverEl = this.doc.querySelector(SELECTORS.rating.containerSelector);

    // Verify they exist
    // jscs:disable maximumLineLength
    assert(addObserverEl, 'Failed to find addObserver element for hooks "#' + SELECTORS.info.containerId + '"');
    assert(shuffleObserverEl, 'Failed to find shuffleObserver element for hooks "' + SELECTORS.shuffle.buttonSelector + '"');
    assert(repeatObserverEl, 'Failed to find repeatObserver element for hooks "' + SELECTORS.repeat.buttonSelector + '"');
    assert(playbackObserverEl, 'Failed to find playbackObserver element for hooks "' + SELECTORS.playPause.buttonSelector + '"');
    assert(playbackTimeObserverEl, 'Failed to find playbackTimeObserver element for hooks "#' + SELECTORS.playback.sliderId + '"');
    assert(ratingObserverEl, 'Failed to find ratingObserver element for hooks "' + SELECTORS.rating.containerSelector + '"');
    // jscs:enable maximumLineLength

    // Bind our elements
    addObserver.observe(addObserverEl, {
      childList: true,
      subtree: true
    });
    shuffleObserver.observe(shuffleObserverEl, {
      attributes: true
    });
    repeatObserver.observe(repeatObserverEl, {
      attributes: true
    });
    playbackObserver.observe(playbackObserverEl, {
      attributes: true
    });
    playbackTimeObserver.observe(playbackTimeObserverEl, {
      attributes: true
    });
    ratingObserver.observe(ratingObserverEl, {
      attributes: true,
      subtree: true
    });
  }
};

// Expose selectors as a class property
GoogleMusic.SELECTORS = SELECTORS;

// Export our constructor
module.exports = GoogleMusic;
