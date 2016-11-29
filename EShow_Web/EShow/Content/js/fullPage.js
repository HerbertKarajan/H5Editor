﻿/* 
 * rusherwang
 * rusherwang@tencent.com
 * create: 2014.4.2
 * update: 2015.10.30
 * Github: https://github.com/powy1993/fullpage
 */

function FullPage(options) {

	"use strict";

	var pageContain = document.getElementById(options.id),
		page = pageContain.children,
		pagelen = page.length,
		iPage = pagelen,
		sTime = options.slideTime || 800,
		effect = options.effect || {},
		indexNow = 0,
		browser = {},
		pageRange = {},
		cubicCurve = {},
		pageStyle = [],
		stepArr = [],
		stepNow = [],
		mode = [],
		modeLen,
		navChildren,
		SPACE = ' ',
		_interval = null,
		_isLocked = false,
		_isNav = false,
		_curve,
		_t,
		_fix,
		init,
		setCubic,
		trans,
		resetAndRun,
		checkStep,
		onTap,
		replaceClass,
		roundPage,
		goPage,
		navChange,
		wheelScroll;

	if (!page || pagelen === 1) return;
	if (options.mode) {
		_isNav = options.mode.indexOf('nav:') !== -1;
		mode = options.mode.split(',');
		modeLen = mode.length;
	}
	for (_t = 0; _t < pagelen; _t++) {
		pageStyle.push(page[_t].style);
		stepArr.push(+page[_t].getAttribute('data-step') || 0);
		stepNow.push(0);
	}

	browser = {

        addEventListener : !!window.addEventListener,
        gravity : !!window.DeviceOrientationEvent,
        touch : ('ontouchstart' in window) || 
                window.DocumentTouch && document instanceof DocumentTouch,

        version: function() {

            var u = navigator.userAgent,
                matchVersion = u.indexOf('Android'),
                num;

            _fix = u.indexOf('QQBrowser') !== -1 ? 200 : 0;

            if (matchVersion !== -1) {
                num = u.substring(matchVersion + 7, matchVersion + 11).replace(' ', '');
            }
            return num || 0;     //0: not Android device
        }(),

        cssCore: function(testCss) {

            switch (true) {
                case testCss.webkitTransition === '':
                return 'webkit'; break;
                case testCss.MozTransition === '':
                return 'Moz'; break;
                case testCss.msTransition === '':
                return 'ms'; break;
                case testCss.OTransition === '':
                return 'O'; break;
                default:
                return '';
            }
        }(document.createElement('Chriswang').style)
    };


	function UnitBezier(p1x, p1y, p2x, p2y) {
		// pre-calculate the polynomial coefficients
		// First and last control points are implied to be (0,0) and (1.0, 1.0)
		this.cx = 3.0 * p1x;
		this.bx = 3.0 * (p2x - p1x) - this.cx;
		this.ax = 1.0 - this.cx -this.bx;
		 
		this.cy = 3.0 * p1y;
		this.by = 3.0 * (p2y - p1y) - this.cy;
		this.ay = 1.0 - this.cy - this.by;
	}

	UnitBezier.prototype = {
		epsilon : 1e-2,     // Precision  
		sampleCurveX : function(t) {
	    	return ((this.ax * t + this.bx) * t + this.cx) * t;
		},
		sampleCurveY : function(t) {
	    	return ((this.ay * t + this.by) * t + this.cy) * t;
		},
		sampleCurveDerivativeX : function(t) {
	    	return (3.0 * this.ax * t + 2.0 * this.bx) * t + this.cx;
		},
		solveCurveX : function(x, epsilon) {
			var t0,
				t1,
				t2,
				x2,
				d2,
				i;

			// First try a few iterations of Newton's method -- normally very fast.
			for (t2 = x, i = 0; i < 8; i++) {
			    x2 = this.sampleCurveX(t2) - x;
			    if (Math.abs (x2) < epsilon)
			        return t2;
			    d2 = this.sampleCurveDerivativeX(t2);
			    if (Math.abs(d2) < epsilon)
			        break;
			    t2 = t2 - x2 / d2;
			}

			// No solution found - use bi-section
			t0 = 0.0;
			t1 = 1.0;
			t2 = x;

			if (t2 < t0) return t0;
			if (t2 > t1) return t1;

			while (t0 < t1) {
				x2 = this.sampleCurveX(t2);
				if (Math.abs(x2 - x) < epsilon)
					return t2;
				if (x > x2) t0 = t2;
				else t1 = t2;

				t2 = (t1 - t0) * .5 + t0;
			}

			// Give up
			return t2;
		},

		// Find new T as a function of Y along curve X
		solve : function(x, epsilon) {
	    	return this.sampleCurveY( this.solveCurveX(x, epsilon) );
		}
	}

	init = function() {
		
		var i = pagelen;

		pageRange = {
			X : document.documentElement.clientWidth || window.innerWidth,
			Y : document.documentElement.clientHeight || window.innerHeight
		}

		//pageContain.style.height = pageRange.Y + 'px';

	}

	setCubic = function(a, b, c, d) {

		cubicCurve.A = a;
		cubicCurve.B = b;
		cubicCurve.C = c;
		cubicCurve.D = d;
	}

	if (typeof options.easing === 'string') {

		switch (options.easing) {

			case 'ease' : 
			setCubic(0.25, 0.1, 0.25, 1);
			break;

			case 'linear' :
			setCubic(0, 0, 1, 1);
			break;

			case 'ease-in' : 
			setCubic(0.42, 0, 1, 1);
			break;

			case 'ease-out' :
			setCubic(0, 0, 0.58, 1);
			break;

			case 'ease-in-out' :
			setCubic(0.42, 0, 0.58, 1);
			break;
		}
	} else {
		setCubic(options.easing[0], options.easing[1], options.easing[2], options.easing[3]);
	}

	if (browser.cssCore !== '') {
		
		while (iPage--) {

			pageStyle[iPage][browser.cssCore + 'TransitionTimingFunction'] = 'cubic-bezier(' 
																		   + cubicCurve.A + ',' 
																		   + cubicCurve.B + ',' 
																		   + cubicCurve.C + ',' 
																		   + cubicCurve.D + ')';
		}

		trans = function(o, x, y, t) {

			var s = o.style,
				c = 'translate(' + x +'px,' + y + 'px) translateZ(0)',
				a = arguments[4];

			if (a.scale) {
				c += t === 0 ? ' scale(' + a.scale[0] + ')'
							 : ' scale(' + a.scale[1] + ')';
			}

			if (a.rotate) {
				c += t === 0 ? ' rotate(' + a.rotate[0] + 'deg)'
							 : ' rotate(' + a.rotate[1] + 'deg)';
			}
			s[browser.cssCore + 'TransformOrigin'] = '50% 50%';
			s[browser.cssCore + 'Transform'] = c;
		}
	} else {
		// simulate translate for ie9- 
		// Cubic-bezier : Fn(t) = (3p1-3p2+1)t^3+(3p2-6p1)t^2-3p1t.
		_curve = new UnitBezier(cubicCurve.A, cubicCurve.B, cubicCurve.C, cubicCurve.D);

		trans = function(o, x, y, t) {

			var cs  = o.currentStyle,
				s   = o.style,
				cx  = parseInt(s.left || cs.left, 10),
				cy  = parseInt(s.top  || cs.top, 10),
				dx  = x - cx,
				dy  = y - cy,
				ft  = +new Date,
				end = ft + t,
				pos = 0,
				e   = effect.opacity,
				diff;

			clearInterval(_interval);

			_interval = setInterval(function() {

				var _t;

				if (+new Date > end) {

					_t = e ? 'left:' + x + 'px;top:' + y + 'px;filter:alpha(opacity=' + 100 * e[1] + ');'
						   : 'left:' + x + 'px;top:' + y + 'px;';

					clearInterval(_interval);
				} else {
					diff = end - new Date;
					pos  = diff / t;
					// fix to cubic-bezier
					pos = _curve.solve(1 - pos, UnitBezier.prototype.epsilon);

					_t = 'left:'  + (cx + dx * pos) 
								  + 'px;top:' + (cy + dy * pos) 
								  + 'px;'
					if (e) {
						_t += 'filter:alpha(opacity=' + ~~(100 * (e[1] * pos - e[0] * (1 - pos)))+ ');'
					}
				}
				s.cssText = _t;
			}, 13);
		}
	}

	resetAndRun = {
		transform : function(o, from, to) {

			var rangeNow = 0,
				fix = browser.cssCore === ''
					&& (o['translate'] === 'none' || !o.translate ) ? -50 : _fix;

			switch (o['translate']) {
				case 'Y' :
				rangeNow = to > from ? pageRange.Y : - pageRange.Y;
				trans(page[to], 0, rangeNow, 0, o);
				break;

				case 'X' :
				rangeNow = to > from ? pageRange.X : - pageRange.X;
				trans(page[to], rangeNow, 0, 0, o);
				break;

				case 'XY' :
				rangeNow = {
					X : to > from ? pageRange.X : - pageRange.X, 
					Y : to > from ? pageRange.Y : - pageRange.Y
				}
				trans(page[to], rangeNow.X, rangeNow.Y, 0, o);
				break;

				default:
				trans(page[to], 0, 0, 0, o);
				break;
			}
			setTimeout(function() {
				trans(page[to], 0, 0, sTime, o);
			}, fix + 50);
		},
		opacity : function(o, from, to) {
			var s = page[to].style;

			s.opacity = o[0];
			setTimeout(function() {
				s.opacity = o[1];
			}, 70);
		}
	}

	if (browser.addEventListener && browser.touch) {
		if (navigator.userAgent.indexOf('Firefox')) {
			onTap = function(o, fn) {
				o.addEventListener('click', fn, false);
			}
		} else {
			onTap = function (o, fn) {
				o.addEventListener('touchstart', fn, false);
				if (arguments[2]) {       
					// if we touch on navBar we should stop scroll
					o.addEventListener('touchmove', function(e) {
						e.preventDefault();
					}, false);
				}
			}
		}
	} else {
		onTap = function (o, fn) {
			o.onclick = fn;
		}
	}

	replaceClass = function(o, cls, tocls) {

		var oN = o.className,
			arr = [],
			len;

		if (oN.indexOf(cls) !== -1) {

			arr = oN.split(SPACE);
			len = arr.length;
			while (len--) {
				if (arr[len] === cls) {
					if (tocls === SPACE || tocls === '') {
						arr.splice(len, 1);
					} else {
						arr[len] = tocls;
					}
				}
			}
			if (arr.length) {
				o.className = arr.join(SPACE);
			} else {
				o.removeAttribute('class');
				o.removeAttribute('className');
			}
		}

	}

	if (_isNav) {
		navChange = function(from, to) {
			var t = navChildren[to].className;

			replaceClass(navChildren[from], 'active', SPACE);
			navChildren[to].className = t === '' ? 'active' : t + ' active';
		}
	}

	if (options.continuous) {
		roundPage = function(page) {
			var i = pagelen;

			if (arguments[1]) {
				if (page >= pagelen) {
					while (i--) {
						stepNow[i] = 0;
					}
				} else if (page < 0) {
					while (i--) {
						stepNow[i] = stepArr[i];
					}
				}
			}

			return (pagelen + page % pagelen) % pagelen
		}
	}

	checkStep = function(direct) {
		var oldStep = stepNow[indexNow],
			newStep = oldStep + direct;

		if (newStep >= 0 && newStep <= stepArr[indexNow]) {
			if (newStep === 0) {
				replaceClass(page[indexNow], 'step1', '');
				stepNow[indexNow] = newStep;
				return false;
			}
			if (newStep === 1 && oldStep === 0) {
				page[indexNow].className += ' step1';
				stepNow[indexNow] = newStep;
				return false;
			}
			replaceClass(page[indexNow], 'step' + oldStep, 'step' + newStep);
			stepNow[indexNow] = newStep;
			return false;
		}
		return true;
	}

	goPage = function(to) {

		var fix = _fix,
			indexOld,
			_effectNow;

		if (options.beforeChange) {
			if (options.beforeChange(indexNow, page[indexNow]) === 'stop') {
				return;
			}
		}

		if (_isLocked                 			// make sure translate is already
			|| to === indexNow) return;			// don't translate if thispage

		if (options.continuous) {
			to = roundPage(to, 1);
		} else {
			if (to >= pagelen 
				&& stepNow[indexNow] >= stepArr[indexNow] 
				|| to < 0 
				&& stepNow[indexNow] === 0) return;
		}

		_isLocked = true;
		
		if (!arguments[1] && !checkStep(to - indexNow)) {
			return setTimeout(function() {
				_isLocked = false;
			}, sTime);
		}

		for (_effectNow in effect) {
			resetAndRun[_effectNow](effect[_effectNow], indexNow, to);
		}

		fix += browser.cssCore === '' ? 20  : 0 ;
		indexOld = indexNow;
		indexNow = to;
		if (_isNav) navChange(indexOld, indexNow);
		setTimeout(function() {
			// fix for bug in ie6-9 about z-index
			page[to].className += ' slide';	
		}, fix);

		setTimeout(function() {

			pageStyle[to][browser.cssCore + 'TransitionDuration'] = sTime + 'ms';
		}, 20);

		setTimeout(function() {

			replaceClass(page[indexOld], 'current', '');
			replaceClass(page[indexNow], 'slide', 'current');

			if (options.callback) {
				options.callback(indexNow, page[indexNow]);
			}

			_isLocked = false;
		}, sTime + _fix + 120);

	}
	
	init();
	// Tag first page
	_t = page[indexNow].className;
	page[indexNow].className = _t.indexOf('current') !== -1 ? _t : _t + ' current';

	if (browser.addEventListener) {

		window.addEventListener('resize', init, false);
	} else {

		window.onresize = init;
	}
	// check mode
	while (modeLen--) {

		(function(m) {

			switch (true) {
				case m === 'wheel' : 
				wheelScroll = function(e) {

					var direct;
					e = e || window.event;
					if (e.preventDefault) {
						e.preventDefault();
					} else {
						e.returnValue = false;
					}
					if (_isLocked) return;
					direct = - e.wheelDelta ||  e.detail;
					direct = direct < 0 ? -1 : 1;

					goPage(indexNow + direct);
				}
				if (browser.addEventListener) {
					document.addEventListener('DOMMouseScroll', wheelScroll, false);
				}
				window.onmousewheel = document.onmousewheel = wheelScroll;
				break;

				case m === 'touch' :
				if (!browser.addEventListener) break;
				(function() {

					var pageIndexMax = pagelen - 1,
						scaleStart = effect.transform.scale[0],
						scaleDiff = effect.transform.scale[1] - scaleStart,
						rotateStart = effect.transform.rotate[0],
						rotateDiff = effect.transform.rotate[1] - rotateStart,
						opacityStart = effect.opacity[0],
						opacityDiff = effect.opacity[1] - opacityStart,
						touchEvent = {},
						start = {},
						delta = {},
						isValidMove = false,
						isWindowsPhone = navigator.userAgent.indexOf('Windows Phone') === -1 ? false : true,
						prev,
						next,
						setIndex,
						reset,
						validReset,
						move,
						_interval,
						_touch,
						_t;

					if (!browser.touch && isWindowsPhone) {
						if (window.navigator.msPointerEnabled) {
							_touch = {
								start: 'MSPointerDown',
								move: 'MSPointerMove',
								end: 'MSPointerUp'
							}
						} else {
							_touch = {
								start: 'pointerDown',
								move: 'pointerMove',
								end: 'pointerUp'
							}
						}
					} else {
						_touch = {
							start: 'touchstart',
							move: 'touchmove',
							end: 'touchend'
						}
					}

					if (!_touch) return;
					document.body.ontouchmove = function(e) {
						if (e.preventDefault) {
							e.preventDefault();
						} else {
							e.returnValue = false;
						}
					}

					if (effect.transform.translate === 'Y') {
						setIndex = function() {
							var pr = indexNow - 1, 
								ne = indexNow + 1;

							if (options.continuous) {
								pr = roundPage(pr);
								ne = roundPage(ne);
							}
							prev = pageStyle[pr];
							next = pageStyle[ne];

							if (prev) {
								prev[browser.cssCore + 'TransitionDuration'] = '0ms';
								prev[browser.cssCore + 'Transform'] = 'translate(0,-' + pageRange.Y + 'px) translateZ(0)';
								prev[browser.cssCore + 'TransformOrigin'] = '50% 100%';
								page[pr].className += ' swipe';
							}
							if (next) {
								next[browser.cssCore + 'TransitionDuration'] = '0ms';
								next[browser.cssCore + 'Transform'] = 'translate(0,' + pageRange.Y + 'px) translateZ(0)';
								next[browser.cssCore + 'TransformOrigin'] = '50% 0%';
								page[ne].className += ' swipe';
							}
						}
						move = function (o) {
							
							var pos = Math.abs(o.y / pageRange.Y),
								_t = ' scale(' + ~~(100 * (scaleStart + scaleDiff * pos)) / 100
								   + ') rotate(' + ~~(rotateStart + rotateDiff * pos) + 'deg)';
							
							if (prev && o.y > 0) {
								prev.opacity = ~~(100 * (opacityStart + opacityDiff * pos)) / 100;
								prev[browser.cssCore + 'Transform'] = 'translate(0,' + ~~(o.y - pageRange.Y) + 'px) translateZ(0)' + _t;
							}
							if (next && o.y < 0) {
								next.opacity = ~~(100 * (opacityStart + opacityDiff * pos)) / 100;
								next[browser.cssCore + 'Transform'] = 'translate(0,' + ~~(pageRange.Y + o.y) + 'px) translateZ(0)' + _t;
							}
						}
						reset = function(s, n) {

							var _t = sTime >> 1,
								ne = indexNow + n;

							if (options.continuous) {
								ne = roundPage(ne);
							}
							replaceClass(page[ne], 'swipe', 'slide');
							s.opacity = 1;
							s[browser.cssCore + 'TransitionDuration'] = _t + 'ms';
							s[browser.cssCore + 'Transform'] = 'translate(0,'+ n * pageRange.Y + 'px) translateZ(0)';
							setTimeout(function() {
								replaceClass(page[ne], 'slide', '');
								setTimeout(function() {
									_isLocked = false;
								}, 50);
							}, _t);
						}
						validReset = function(s, n) {

							var to = indexNow + n,
								_t = ~~(sTime / 1.5),
								_o,
								_f;

							if (options.continuous) {
								to = roundPage(to);
								_o = page[ roundPage(indexNow - n) ];
								_f = true;
							} else {
								_o = page[indexNow - n];
							}

							if (_o) {
								replaceClass(_o, 'swipe', '');
							} 
							if (!_f && to < 0 || to > pagelen - 1) {
								setTimeout(function() {
									_isLocked = false;
								}, 50);
								return;
							}

							if (_isNav) {
								navChange(indexNow, to);
							}
							
							s.opacity = 1;
							replaceClass(page[to], 'swipe', 'slide');
							s[browser.cssCore + 'TransitionDuration'] = _t + 'ms';
							s[browser.cssCore + 'Transform'] = 'translate(0,0) translateZ(0)';
							setTimeout(function() {
								replaceClass(page[indexNow], 'current', '');
								replaceClass(page[to], 'slide', 'current');
								indexNow = to;
								if (options.callback) {
									options.callback(indexNow, page[indexNow]);
								}
								setTimeout(function() {
									_isLocked = false;
								}, 50)
							}, _t);
						}
					} else {
						setIndex = function() {

							var pr = indexNow - 1, 
								ne = indexNow + 1;

							if (options.continuous) {
								pr = roundPage(pr);
								ne = roundPage(ne);
							}
							prev = pageStyle[pr];
							next = pageStyle[ne];

							if (prev) {
								prev[browser.cssCore + 'TransitionDuration'] = '0ms';
								prev[browser.cssCore + 'Transform'] = 'translate(-' + pageRange.X + 'px,0) translateZ(0)';
								prev[browser.cssCore + 'TransformOrigin'] = '100% 50%';
								page[pr].className += ' swipe';
							}
							if (next) {
								next[browser.cssCore + 'TransitionDuration'] = '0ms';
								next[browser.cssCore + 'Transform'] = 'translate(' + pageRange.X + 'px,0) translateZ(0)';
								next[browser.cssCore + 'TransformOrigin'] = '0 50%';
								page[ne].className += ' swipe';
							}
						}
						move = function (o) {
							
							var pos = Math.abs(o.x / pageRange.X),
								_t = ' scale(' + ~~(100 * (scaleStart + scaleDiff * pos)) / 100
								   + ') rotate(' + ~~(rotateStart + rotateDiff * pos) + 'deg)';
							
							if (prev && o.x > 0) {
								prev.opacity = ~~(100 * (opacityStart + opacityDiff * pos)) / 100;
								prev[browser.cssCore + 'Transform'] = 'translate(' + ~~(o.x - pageRange.X) + 'px,0) translateZ(0)' + _t;
							}
							if (next && o.x < 0) {
								next.opacity = ~~(100 * (opacityStart + opacityDiff * pos)) / 100;
								next[browser.cssCore + 'Transform'] = 'translate(' + ~~(pageRange.X + o.x) + 'px,0) translateZ(0)' + _t;
							}
						}
						reset = function(s, n) {

							var _t = sTime >> 1,
								ne = indexNow + n;

							if (options.continuous) {
								ne = roundPage(ne);
							}
							replaceClass(page[ne], 'swipe', 'slide');

							s.opacity = 1;
							s[browser.cssCore + 'TransitionDuration'] = _t + 'ms';
							s[browser.cssCore + 'Transform'] = 'translate('+ n * pageRange.X + 'px,0) translateZ(0)';
							setTimeout(function() {
								replaceClass(page[ne], 'slide', '');
								setTimeout(function() {
									_isLocked = false;
								}, 50);
							}, _t);
						}
						validReset = function(s, n) {

							var to = indexNow + n,
								_t = ~~(sTime / 1.5),
								_o,
								_f;

							if (options.continuous) {
								to = roundPage(to);
								_o = page[ roundPage(indexNow - n) ];
								_f = true;
							} else {
								_o = page[indexNow - n];
							}

							if (_o) {
								replaceClass(_o, 'swipe', '');
							} 
							if (!_f && to < 0 || to > pagelen - 1) {
								setTimeout(function() {
									_isLocked = false;
								}, 50);
								return;
							}

							if (_isNav) {
								navChange(indexNow, to);
							}
							
							replaceClass(page[to], 'swipe', 'slide');
							s.opacity = 1;
							s[browser.cssCore + 'TransitionDuration'] = _t + 'ms';
							s[browser.cssCore + 'Transform'] = 'translate(0,0) translateZ(0)';
							setTimeout(function() {
								replaceClass(page[indexNow], 'current', '');
								replaceClass(page[to], 'slide', 'current');
								indexNow = to;
								if (options.callback) {
									options.callback(indexNow, page[indexNow]);
								}
								setTimeout(function() {
									_isLocked = false;
								}, 50)
							}, _t);
						}
					}


					touchEvent = {
						start : function(e) {

							var touches = e.touches ? e.touches[0] : e;

							if (_isLocked) return;
							_isLocked = true;

							start = {
								x : touches.pageX,
								y : touches.pageY,
								time : +new Date
							}

							if (options.onSwipeStart 
								&& options.onSwipeStart(indexNow, page[indexNow]) === 'stop') {
								return _isLocked = false;
							}
							// reset
							delta = {};
							isValidMove = false;

							setIndex();

							pageContain.addEventListener(_touch.move, touchEvent.move, false);
							pageContain.addEventListener(_touch.end, touchEvent.end, false);
						},
						move : function(e) {

							var touches = e.touches ? e.touches[0] : e,
								direct;

							e.preventDefault();
							// ensure swiping with one touch and not pinching
      						if (browser.touch 
      							&& (event.touches.length > 1 
      								|| event.scale && event.scale !== 1)) return

							delta = {
								x : touches.pageX - start.x,
								y : touches.pageY - start.y
							}

							if (!isValidMove) {
								_t = Math.abs(delta.x) > Math.abs(delta.y) ? 'X' : 'Y';
								_t = _t === options.effect.transform['translate'] ? true : false;
								isValidMove = true;
							} else {
								if (options.effect.transform['translate'] === 'X') {
									direct = delta.x < 0 ? 1 : -1;
								} else {
									direct = delta.y < 0 ? 1 : -1;
								}
								if (stepNow[indexNow] + direct >= 0 && stepNow[indexNow] + direct <= stepArr[indexNow]) return;
								if (_t) move(delta);
							}
						},
						end : function(e) {

							var touches = e.changedTouches ? e.changedTouches[0] : e,
								duration = +new Date - start.time,
								abs = {},
								nextDiff = 0,
								isValidSlide = false;

							delta = {
								x : touches.pageX - start.x,
								y : touches.pageY - start.y
							}
							abs = {
								x : Math.abs(delta.x),
								y : Math.abs(delta.y)
							}

							switch (options.effect.transform['translate']) {
								case 'Y' :
								isValidSlide = 
									+  duration < 250 && abs.y > 30
									|| abs.y > pageRange.Y * .3;
								nextDiff = delta.y > 0 ? -1 : 1;
								break;

								case 'X' :
								isValidSlide = 
									+  duration < 250 && abs.x > 30
									|| abs.x > pageRange.X * .3;
								nextDiff = delta.x > 0 ? -1 : 1;
								break;

								default :
								isValidSlide = 
									+  duration < 350 && abs.y + abs.x > 50
									|| abs.y > pageRange.Y * .3
									|| abs.x > pageRange.X * .3;
								nextDiff = abs.x > abs.y ? 
									   delta.x > 0 ? -1 : 1
									 : delta.y > 0 ? -1 : 1;
								break;
							}
							
							
							if (!isValidSlide 
								|| !_t 
								|| !checkStep(nextDiff)
								|| options.continuous === false 
								&& (!prev && nextDiff === -1 || !next && nextDiff === 1)) {
								if (prev) reset(prev, - 1);
								if (next) reset(next, + 1);
							} else if (options.beforeChange 
									   && options.beforeChange(indexNow, page[indexNow]) === 'stop') {
								if (prev) reset(prev, - 1);
								if (next) reset(next, + 1);
							} else if (nextDiff === -1) {
							 	validReset(prev, -1);
							} else {
								validReset(next, 1);
							}
							pageContain.removeEventListener(_touch.move, touchEvent.move, false);
							pageContain.removeEventListener(_touch.end, touchEvent.end, false);

						}

					}

					pageContain.addEventListener(_touch.start, touchEvent.start, false);
				}());
				break;

				case m.indexOf('nav:') !== -1 : 
				(function() {

					var navId = m.split(':')[1],
						navObj = document.getElementById(navId),
						navLen,
						gotoPage,
						_t;

					navChildren = navObj.children;
					navLen = navChildren.length;
					_t = navChildren[indexNow].className;

					if (!navObj || !navChildren) return;

					while (navLen--) {
						// set attr for finding specific page
						navChildren[navLen].setAttribute('data-page', navLen);
					}
					if (_t.indexOf('active') === -1) {
						navChildren[indexNow].className = _t === '' ? 'active' : _t + ' active';
					}

					gotoPage = function(e) {

						var t;
						e = e || window.event;
						e = e.target || e.srcElement;

						t = e.tagName.toLowerCase();

						while (t !== 'li') {
							if (t === 'ul') return;
							e = e.parentNode;
							t = e.tagName.toLowerCase();
						}

						goPage( + e.getAttribute('data-page'), 1); 
					}
					// bind event to navObj
					onTap(navObj, gotoPage, 1);
				}());
			}
		}(mode[modeLen]));
	}

	return {
		thisPage : function() {
			return indexNow;
		},
		go : function(num) {
			goPage(num);
		},
		next : function() {
			goPage(indexNow + 1);
		},
		prev : function() {
			goPage(indexNow - 1);
		}
	}
}
