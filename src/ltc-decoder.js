    /**
     * Simple event emitter implementation for the browser.  Each listener
     * registered with `.on(event, handler)` will be invoked when the
     * corresponding `.emit(event, ...args)` call happens.  This avoids
     * depending on Node's built‑in EventEmitter which is not available in
     * browsers.
     */
    class SimpleEventEmitter {
        constructor() {
            this._events = {};
        }
        on(event, listener) {
            if (!this._events[event]) this._events[event] = [];
            this._events[event].push(listener);
        }
        emit(event, ...args) {
            if (this._events[event]) {
                this._events[event].forEach((fn) => fn(...args));
            }
        }
    }

    /**
     * Frame encapsulates a single decoded LTC frame.  It exposes `hours`,
     * `minutes`, `seconds`, `frames`, and a `toString()` method for display.
     */
    class Frame {
        constructor(fps = 25) {
            this.fps = fps;
            this.frames = 0;
            this.seconds = 0;
            this.minutes = 0;
            this.hours = 0;
        }
        /** Parse raw LTC bytes (10 bytes) into time fields. */
        decode(bytes) {
            if (!bytes || bytes.length < 10) return;
            this.frames = (bytes[0] & 0x0f) + ((bytes[1] & 0x03) * 10);
            this.seconds = (bytes[2] & 0x0f) + ((bytes[3] & 0x07) * 10);
            this.minutes = (bytes[4] & 0x0f) + ((bytes[5] & 0x07) * 10);
            this.hours = (bytes[6] & 0x0f) + ((bytes[7] & 0x03) * 10);
        }
        toString() {
            const p = (n) => n.toString().padStart(2, '0');
            return `${p(this.hours)}:${p(this.minutes)}:${p(this.seconds)}:${p(this.frames)}`;
        }
    }

    /**
     * Decoder is a simple LTC audio decoder.  It processes PCM float samples
     * and emits `frame` events when a valid SMPTE timecode frame is detected.
     * It is intentionally kept simple and may skip frames or produce errors
     * in noisy conditions; however it is sufficient for many stage prompter
     * scenarios where timecode is delivered over a clean audio feed.
     */
    function Decoder(sampleRate) {
        SimpleEventEmitter.call(this);
        this.rate = sampleRate || 48000;
        this.framerate = 25;
        this.last_frame = null;
        this.state = {
            prev_sample: null,
            counter: 0,
            middle_transition: 0,
            bit_buffer: '',
        };
        /**
         * Decode a chunk of PCM samples.  `samples` should be a Float32Array or
         * similar, with values normalised between −1 and 1 and centred around
         * zero (no DC offset).  The decoder maintains internal state across
         * calls, so sequential calls will accumulate bit timing until a full
         * LTC frame (80 bits) is parsed.
         * @param {Float32Array|Array<number>} samples
         */
        this.decode = function (samples) {
            let bit_array = '';
            // restore state
            let prev_sample = this.state.prev_sample;
            let counter = this.state.counter;
            let middle_transition = this.state.middle_transition;
            if (prev_sample == null && samples.length > 0) {
                prev_sample = samples[0];
            }
            // iterate through each sample and detect transitions
            for (let i = 0; i < samples.length; i++) {
                const sample = samples[i];
                // maintaining same sign (positive/negative) state
                if (prev_sample > 0 && sample > 0) {
                    counter++;
                } else if (prev_sample < 0 && sample < 0) {
                    counter++;
                } else {
                    // a zero crossing occurred; compute frequency from counter
                    const freq = this.rate / counter / 2; // freq of state time is twice the bit frequency
                    if (freq > 900 && freq <= 1560) {
                        bit_array += '0';
                    } else if (freq > 1560 && freq < 3000) {
                        if (middle_transition) {
                            bit_array += '1';
                            middle_transition = 0;
                        } else {
                            middle_transition = 1;
                        }
                    } else {
                        // invalid frequency; ignore and reset state counters
                    }
                    counter = 0;
                }
                prev_sample = sample;
            }
            // save state
            this.state.prev_sample = prev_sample;
            this.state.counter = counter;
            this.state.middle_transition = middle_transition;
            // compute approximate framerate from bitrate (80 bits per frame)
            const bitrate = bit_array.length / (samples.length / this.rate);
            if (!isNaN(bitrate) && bitrate > 0) {
                this.framerate = Math.round(bitrate / 80);
            }
            // merge new bits into buffer and attempt to parse frames
            this.state.bit_buffer = this.state.bit_buffer + bit_array;
            // while there is enough data for a frame, attempt to parse it
            while (this.state.bit_buffer.length >= 80) {
                if (!this._parseBits()) {
                    // if we have two frames worth of data and still no frame, drop one frame
                    if (this.state.bit_buffer.length > 160) {
                        this.state.bit_buffer = this.state.bit_buffer.slice(160);
                    }
                    break;
                }
            }
        };
        /**
         * Internal helper to parse the bit buffer for a valid LTC frame.  If
         * successful it emits a 'frame' event with a Frame instance and
         * returns true, otherwise false.  The bit buffer is advanced past
         * the parsed frame or remains unchanged if no frame is found.
         * @returns {boolean}
         */
        this._parseBits = function () {
            const bit_string = this.state.bit_buffer;
            const sync_word_idx = bit_string.indexOf('111111111111');
            if (sync_word_idx < 0) return false;
            // check forward direction: preceding bits 00 and following bits 01
            if (bit_string.substring(sync_word_idx - 2, sync_word_idx) === '00' && bit_string.substring(sync_word_idx + 12, sync_word_idx + 14) === '01') {
                // convert bits into bytes (10 bytes, reversed bit order)
                const bytes = [];
                for (let i = sync_word_idx - 66; i < sync_word_idx + 14; i += 8) {
                    const bits = bit_string
                        .substring(i, i + 8)
                        .split('')
                        .reverse()
                        .join('');
                    const byte = parseInt(bits, 2);
                    bytes.push(byte);
                }
                const frame = new Frame(this.framerate || 25);
                frame.decode(bytes);
                this.last_frame = frame;
                this.emit('frame', frame);
                // drop parsed bits
                this.state.bit_buffer = bit_string.slice(sync_word_idx + 14);
                return true;
            } else {
                // unsupported direction; skip this sync pattern
                return false;
            }
        };
    }
    // inherit SimpleEventEmitter methods
    Decoder.prototype = Object.create(SimpleEventEmitter.prototype);
    Decoder.prototype.constructor = Decoder;
