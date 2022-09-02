(function(){
var createModuleFactory = function createModuleFactory(t){var e;return function(r){return e||t(e={exports:{},parent:r},e.exports),e.exports}};
var _$CronJob_3 = createModuleFactory(function (module, exports) {
function CronJob(CronTime, spawn) {
	function fnWrap(cmd) {
		var command;
		var args;

		switch (typeof cmd) {
			case 'string':
				args = cmd.split(' ');
				command = args.shift();

				return spawn.bind(undefined, command, args);

			case 'object':
				command = cmd && cmd.command;
				if (command) {
					args = cmd.args;
					var options = cmd.options;

					return spawn.bind(undefined, command, args, options);
				}
				break;
		}

		return cmd;
	}

	function CJ(
		cronTime,
		onTick,
		onComplete,
		startNow,
		timeZone,
		context,
		runOnInit,
		utcOffset,
		unrefTimeout
	) {
		var _cronTime = cronTime;
		var argCount = 0;
		for (var i = 0; i < arguments.length; i++) {
			if (arguments[i] !== undefined) {
				argCount++;
			}
		}

		if (typeof cronTime !== 'string' && argCount === 1) {
			// crontime is an object...
			onTick = cronTime.onTick;
			onComplete = cronTime.onComplete;
			context = cronTime.context;
			startNow = cronTime.start || cronTime.startNow || cronTime.startJob;
			timeZone = cronTime.timeZone;
			runOnInit = cronTime.runOnInit;
			_cronTime = cronTime.cronTime;
			utcOffset = cronTime.utcOffset;
			unrefTimeout = cronTime.unrefTimeout;
		}

		this.context = context || this;
		this._callbacks = [];
		this.onComplete = fnWrap(onComplete);
		this.cronTime = new CronTime(_cronTime, timeZone, utcOffset);
		this.unrefTimeout = unrefTimeout;

		addCallback.call(this, fnWrap(onTick));

		if (runOnInit) {
			this.lastExecution = new Date();
			fireOnTick.call(this);
		}

		if (startNow) {
			start.call(this);
		}

		return this;
	}

	var addCallback = function (callback) {
		if (typeof callback === 'function') {
			this._callbacks.push(callback);
		}
	};
	CJ.prototype.addCallback = addCallback;

	CJ.prototype.setTime = function (time) {
		if (typeof time !== 'object') {
			// crontime is an object...
			throw new Error('time must be an instance of CronTime.');
		}
		this.stop();
		this.cronTime = time;
		this.start();
	};

	CJ.prototype.nextDate = function () {
		return this.cronTime.sendAt();
	};

	var fireOnTick = function () {
		for (var i = this._callbacks.length - 1; i >= 0; i--) {
			this._callbacks[i].call(this.context, this.onComplete);
		}
	};
	CJ.prototype.fireOnTick = fireOnTick;

	CJ.prototype.nextDates = function (i) {
		return this.cronTime.sendAt(i);
	};

	var start = function () {
		if (this.running) {
			return;
		}

		var MAXDELAY = 2147483647; // The maximum number of milliseconds setTimeout will wait.
		var self = this;
		var timeout = this.cronTime.getTimeout();
		var remaining = 0;
		var startTime;

		if (this.cronTime.realDate) {
			this.runOnce = true;
		}

		function _setTimeout(timeout) {
			startTime = Date.now();
			self._timeout = setTimeout(callbackWrapper, timeout);
			if (self.unrefTimeout && typeof self._timeout.unref === 'function') {
				self._timeout.unref();
			}
		}

		// The callback wrapper checks if it needs to sleep another period or not
		// and does the real callback logic when it's time.
		function callbackWrapper() {
			var diff = startTime + timeout - Date.now();

			if (diff > 0) {
				var newTimeout = self.cronTime.getTimeout();

				if (newTimeout > diff) {
					newTimeout = diff;
				}

				remaining += newTimeout;
			}

			// If there is sleep time remaining, calculate how long and go to sleep
			// again. This processing might make us miss the deadline by a few ms
			// times the number of sleep sessions. Given a MAXDELAY of almost a
			// month, this should be no issue.
			self.lastExecution = new Date();
			if (remaining) {
				if (remaining > MAXDELAY) {
					remaining -= MAXDELAY;
					timeout = MAXDELAY;
				} else {
					timeout = remaining;
					remaining = 0;
				}

				_setTimeout(timeout);
			} else {
				// We have arrived at the correct point in time.

				self.running = false;

				// start before calling back so the callbacks have the ability to stop the cron job
				if (!self.runOnce) {
					self.start();
				}

				self.fireOnTick();
			}
		}

		if (timeout >= 0) {
			this.running = true;

			// Don't try to sleep more than MAXDELAY ms at a time.

			if (timeout > MAXDELAY) {
				remaining = timeout - MAXDELAY;
				timeout = MAXDELAY;
			}

			_setTimeout(timeout);
		} else {
			this.stop();
		}
	};

	CJ.prototype.start = start;

	CJ.prototype.lastDate = function () {
		return this.lastExecution;
	};

	/**
	 * Stop the cronjob.
	 */
	CJ.prototype.stop = function () {
		if (this._timeout) clearTimeout(this._timeout);
		this.running = false;
		if (typeof this.onComplete === 'function') {
			this.onComplete();
		}
	};

	return CJ;
}

module.exports = CronJob;

});
var _$CronTime_4 = createModuleFactory(function (module, exports) {
const CONSTRAINTS = [
	[0, 59],
	[0, 59],
	[0, 23],
	[1, 31],
	[0, 11],
	[0, 6]
];
const MONTH_CONSTRAINTS = [
	31,
	29, // support leap year...not perfect
	31,
	30,
	31,
	30,
	31,
	31,
	30,
	31,
	30,
	31
];
const PARSE_DEFAULTS = ['0', '*', '*', '*', '*', '*'];
const ALIASES = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11,
	sun: 0,
	mon: 1,
	tue: 2,
	wed: 3,
	thu: 4,
	fri: 5,
	sat: 6
};
const TIME_UNITS = [
	'second',
	'minute',
	'hour',
	'dayOfMonth',
	'month',
	'dayOfWeek'
];
const TIME_UNITS_LEN = TIME_UNITS.length;
const PRESETS = {
	'@yearly': '0 0 0 1 0 *',
	'@monthly': '0 0 0 1 * *',
	'@weekly': '0 0 0 * * 0',
	'@daily': '0 0 0 * * *',
	'@hourly': '0 0 * * * *',
	'@minutely': '0 * * * * *',
	'@secondly': '* * * * * *',
	'@weekdays': '0 0 0 * * 1-5',
	'@weekends': '0 0 0 * * 0,6'
};
const RE_WILDCARDS = /\*/g;
const RE_RANGE = /^(\d+)(?:-(\d+))?(?:\/(\d+))?$/g;

function CronTime(luxon) {
	function CT(source, zone, utcOffset) {
		this.source = source;

		if (zone) {
			const dt = luxon.DateTime.fromObject({ zone: zone });
			if (dt.invalid) {
				throw new Error('Invalid timezone.');
			}

			this.zone = zone;
		}

		if (typeof utcOffset !== 'undefined') {
			this.utcOffset = utcOffset;
		}

		var that = this;
		TIME_UNITS.map(timeUnit => {
			that[timeUnit] = {};
		});

		if (this.source instanceof Date || this.source instanceof luxon.DateTime) {
			if (this.source instanceof Date) {
				this.source = luxon.DateTime.fromJSDate(this.source);
			}
			this.realDate = true;
		} else {
			this._parse(this.source);
			this._verifyParse();
		}
	}

	CT.prototype = {
		/*
		 * Ensure that the syntax parsed correctly and correct the specified values if needed.
		 */
		_verifyParse: function () {
			var months = Object.keys(this.month);
			var dom = Object.keys(this.dayOfMonth);
			var ok = false;

			/* if a dayOfMonth is not found in all months, we only need to fix the last
                 wrong month  to prevent infinite loop */
			var lastWrongMonth = NaN;
			for (var i = 0; i < months.length; i++) {
				var m = months[i];
				var con = MONTH_CONSTRAINTS[parseInt(m, 10)];

				for (var j = 0; j < dom.length; j++) {
					var day = dom[j];
					if (day <= con) {
						ok = true;
					}
				}

				if (!ok) {
					// save the month in order to be fixed if all months fails (infinite loop)
					lastWrongMonth = m;
					console.warn(`Month '${m}' is limited to '${con}' days.`);
				}
			}

			// infinite loop detected (dayOfMonth is not found in all months)
			if (!ok) {
				var notOkCon = MONTH_CONSTRAINTS[parseInt(lastWrongMonth, 10)];
				for (var k = 0; k < dom.length; k++) {
					var notOkDay = dom[k];
					if (notOkDay > notOkCon) {
						delete this.dayOfMonth[notOkDay];
						var fixedDay = Number(notOkDay) % notOkCon;
						this.dayOfMonth[fixedDay] = true;
					}
				}
			}
		},

		/**
		 * Calculate the "next" scheduled time
		 */
		sendAt: function (i) {
			var date = this.realDate ? this.source : luxon.DateTime.local();
			if (this.zone) {
				date = date.setZone(this.zone);
			}

			if (typeof this.utcOffset !== 'undefined') {
				let offset =
					this.utcOffset >= 60 || this.utcOffset <= -60
						? this.utcOffset / 60
						: this.utcOffset;
				offset = parseInt(offset);

				let utcZone = 'UTC';
				if (offset < 0) {
					utcZone += offset;
				} else if (offset > 0) {
					utcZone += `+${offset}`;
				}

				date = date.setZone(utcZone);

				if (date.invalid) {
					throw new Error('ERROR: You specified an invalid UTC offset.');
				}
			}

			if (this.realDate) {
				if (luxon.DateTime.local() > date) {
					throw new Error('WARNING: Date in past. Will never be fired.');
				}

				return date;
			}

			if (isNaN(i) || i < 0) {
				// just get the next scheduled time
				return this._getNextDateFrom(date);
			} else {
				// return the next schedule times
				var dates = [];
				for (; i > 0; i--) {
					date = this._getNextDateFrom(date);
					dates.push(date);
				}

				return dates;
			}
		},

		/**
		 * Get the number of milliseconds in the future at which to fire our callbacks.
		 */
		getTimeout: function () {
			return Math.max(-1, this.sendAt() - luxon.DateTime.local());
		},

		/**
		 * writes out a cron string
		 */
		toString: function () {
			return this.toJSON().join(' ');
		},

		/**
		 * Json representation of the parsed cron syntax.
		 */
		toJSON: function () {
			var self = this;
			return TIME_UNITS.map(function (timeName) {
				return self._wcOrAll(timeName);
			});
		},

		/**
		 * Get next date matching the specified cron time.
		 *
		 * Algorithm:
		 * - Start with a start date and a parsed crontime.
		 * - Loop until 5 seconds have passed, or we found the next date.
		 * - Within the loop:
		 *   - If it took longer than 5 seconds to select a date, throw an exception.
		 *   - Find the next month to run at.
		 *   - Find the next day of the month to run at.
		 *   - Find the next day of the week to run at.
		 *   - Find the next hour to run at.
		 *   - Find the next minute to run at.
		 *   - Find the next second to run at.
		 *   - Check that the chosen time does not equal the current execution.
		 * - Return the selected date object.
		 */
		_getNextDateFrom: function (start, zone) {
			if (start instanceof Date) {
				start = luxon.DateTime.fromJSDate(start);
			}
			var date = start;
			var firstDate = start.toMillis();
			if (zone) {
				date = date.setZone(zone);
			}
			if (!this.realDate) {
				if (date.millisecond > 0) {
					date = date.set({ millisecond: 0, second: date.second + 1 });
				}
			}

			if (date.invalid) {
				throw new Error('ERROR: You specified an invalid date.');
			}

			// it shouldn't take more than 5 seconds to find the next execution time
			// being very generous with this. Throw error if it takes too long to find the next time to protect from
			// infinite loop.
			var timeout = Date.now() + 5000;
			// determine next date
			while (true) {
				var diff = date - start;

				// hard stop if the current date is after the expected execution
				if (Date.now() > timeout) {
					throw new Error(
						`Something went wrong. It took over five seconds to find the next execution time for the cron job.
							Please refer to the canonical issue (https://github.com/kelektiv/node-cron/issues/467) and provide the following string if you would like to help debug:
							Time Zone: ${zone || '""'} - Cron String: ${this} - UTC offset: ${date.format(
							'Z'
						)} - current Date: ${luxon.DateTime.local().toString()}`
					);
				}

				if (
					!(date.month - 1 in this.month) &&
					Object.keys(this.month).length !== 12
				) {
					date = date.plus({ months: 1 });
					date = date.set({ day: 1, hour: 0, minute: 0, second: 0 });
					continue;
				}

				if (
					!(date.day in this.dayOfMonth) &&
					Object.keys(this.dayOfMonth).length !== 31 &&
					!(
						date.getWeekDay() in this.dayOfWeek &&
						Object.keys(this.dayOfWeek).length !== 7
					)
				) {
					date = date.plus({ days: 1 });
					date = date.set({ hour: 0, minute: 0, second: 0 });
					continue;
				}

				if (
					!(date.getWeekDay() in this.dayOfWeek) &&
					Object.keys(this.dayOfWeek).length !== 7 &&
					!(
						date.day in this.dayOfMonth &&
						Object.keys(this.dayOfMonth).length !== 31
					)
				) {
					date = date.plus({ days: 1 });
					date = date.set({ hour: 0, minute: 0, second: 0 });
					continue;
				}

				if (!(date.hour in this.hour) && Object.keys(this.hour).length !== 24) {
					date = date.set({
						hour: date.hour === 23 && diff > 86400000 ? 0 : date.hour + 1
					});
					date = date.set({ minute: 0, second: 0 });
					continue;
				}

				if (
					!(date.minute in this.minute) &&
					Object.keys(this.minute).length !== 60
				) {
					date = date.set({
						minute: date.minute === 59 && diff > 3600000 ? 0 : date.minute + 1
					});
					date = date.set({ second: 0 });
					continue;
				}

				if (
					!(date.second in this.second) &&
					Object.keys(this.second).length !== 60
				) {
					date = date.set({
						second: date.second === 59 && diff > 60000 ? 0 : date.second + 1
					});
					continue;
				}

				if (date.toMillis() === firstDate) {
					date = date.set({ second: date.second + 1 });
					continue;
				}

				break;
			}

			return date;
		},

		/**
		 * wildcard, or all params in array (for to string)
		 */
		_wcOrAll: function (type) {
			if (this._hasAll(type)) {
				return '*';
			}

			var all = [];
			for (var time in this[type]) {
				all.push(time);
			}

			return all.join(',');
		},

		_hasAll: function (type) {
			var constraints = CONSTRAINTS[TIME_UNITS.indexOf(type)];

			for (var i = constraints[0], n = constraints[1]; i < n; i++) {
				if (!(i in this[type])) {
					return false;
				}
			}

			return true;
		},

		/*
		 * Parse the cron syntax into something useful for selecting the next execution time.
		 *
		 * Algorithm:
		 * - Replace preset
		 * - Replace aliases in the source.
		 * - Trim string and split for processing.
		 * - Loop over split options (ms -> month):
		 *   - Get the value (or default) in the current position.
		 *   - Parse the value.
		 */
		_parse: function (source) {
			source = source.toLowerCase();

			if (source in PRESETS) {
				source = PRESETS[source];
			}

			source = source.replace(/[a-z]{1,3}/gi, alias => {
				if (alias in ALIASES) {
					return ALIASES[alias];
				}

				throw new Error(`Unknown alias: ${alias}`);
			});

			var units = source.trim().split(/\s+/);

			// seconds are optional
			if (units.length < TIME_UNITS_LEN - 1) {
				throw new Error('Too few fields');
			}

			if (units.length > TIME_UNITS_LEN) {
				throw new Error('Too many fields');
			}

			var unitsLen = units.length;
			for (var i = 0; i < TIME_UNITS_LEN; i++) {
				// If the split source string doesn't contain all digits,
				// assume defaults for first n missing digits.
				// This adds support for 5-digit standard cron syntax
				var cur = units[i - (TIME_UNITS_LEN - unitsLen)] || PARSE_DEFAULTS[i];
				this._parseField(cur, TIME_UNITS[i], CONSTRAINTS[i]);
			}
		},

		/*
		 * Parse individual field from the cron syntax provided.
		 *
		 * Algorithm:
		 * - Split field by commas aand check for wildcards to ensure proper user.
		 * - Replace wildcard values with <low>-<high> boundaries.
		 * - Split field by commas and then iterate over ranges inside field.
		 *   - If range matches pattern then map over matches using replace (to parse the range by the regex pattern)
		 *   - Starting with the lower bounds of the range iterate by step up to the upper bounds and toggle the CronTime field value flag on.
		 */
		_parseField: function (value, type, constraints) {
			var typeObj = this[type];
			var pointer;
			var low = constraints[0];
			var high = constraints[1];

			var fields = value.split(',');
			fields.forEach(field => {
				var wildcardIndex = field.indexOf('*');
				if (wildcardIndex !== -1 && wildcardIndex !== 0) {
					throw new Error(
						`Field (${field}) has an invalid wildcard expression`
					);
				}
			});

			// * is a shortcut to [low-high] range for the field
			value = value.replace(RE_WILDCARDS, `${low}-${high}`);

			// commas separate information, so split based on those
			var allRanges = value.split(',');

			for (var i = 0; i < allRanges.length; i++) {
				if (allRanges[i].match(RE_RANGE)) {
					allRanges[i].replace(RE_RANGE, ($0, lower, upper, step) => {
						lower = parseInt(lower, 10);
						upper = parseInt(upper, 10) || undefined;

						const wasStepDefined = !isNaN(parseInt(step, 10));
						if (step === '0') {
							throw new Error(`Field (${type}) has a step of zero`);
						}
						step = parseInt(step, 10) || 1;

						if (upper && lower > upper) {
							throw new Error(`Field (${type}) has an invalid range`);
						}

						const outOfRangeError =
							lower < low ||
							(upper && upper > high) ||
							(!upper && lower > high);

						if (outOfRangeError) {
							throw new Error(`Field value (${value}) is out of range`);
						}

						// Positive integer higher than constraints[0]
						lower = Math.min(Math.max(low, ~~Math.abs(lower)), high);

						// Positive integer lower than constraints[1]
						if (upper) {
							upper = Math.min(high, ~~Math.abs(upper));
						} else {
							// If step is provided, the default upper range is the highest value
							upper = wasStepDefined ? high : lower;
						}

						// Count from the lower barrier to the upper
						pointer = lower;

						do {
							typeObj[pointer] = true; // mutates the field objects values inside CronTime
							pointer += step;
						} while (pointer <= upper);
					});
				} else {
					throw new Error(`Field (${type}) cannot be parsed`);
				}
			}
		}
	};

	return CT;
}

module.exports = CronTime;

});
var _$_empty_1 = createModuleFactory(function (module, exports) {

});
var _$cron_2 = {};
(function (root, factory) {
	if (typeof define === 'function' && define.amd) {
		define(['luxon'], factory);
	} else if (typeof _$cron_2 === 'object') {
		_$cron_2 = factory(require(5), _$_empty_1({}));
	} else {
		root.Cron = factory(root.luxon);
	}
})(this, function (luxon, childProcess) {
	var exports = {};
	var spawn = childProcess && childProcess.spawn;
	const CronTime = _$CronTime_4({})(luxon);
	const CronJob = _$CronJob_3({})(CronTime, spawn);

	/**
	 * Extend Luxon DateTime
	 */
	luxon.DateTime.prototype.getWeekDay = function () {
		return this.weekday === 7 ? 0 : this.weekday;
	};

	exports.job = (
		cronTime,
		onTick,
		onComplete,
		startNow,
		timeZone,
		context,
		runOnInit,
		utcOffset,
		unrefTimeout
	) =>
		new CronJob(
			cronTime,
			onTick,
			onComplete,
			startNow,
			timeZone,
			context,
			runOnInit,
			utcOffset,
			unrefTimeout
		);

	exports.time = (cronTime, timeZone) => new CronTime(cronTime, timeZone);

	exports.sendAt = cronTime => exports.time(cronTime).sendAt();

	exports.timeout = cronTime => exports.time(cronTime).getTimeout();

	exports.CronJob = CronJob;
	exports.CronTime = CronTime;

	return exports;
});

var _$input_6 = {};
(function (global){(function (){
"use strict";

var _cron = _interopRequireDefault(_$cron_2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

global["Cron"] = _cron.default;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
}());