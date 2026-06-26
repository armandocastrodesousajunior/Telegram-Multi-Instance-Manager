"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "instrumentation";
exports.ids = ["instrumentation"];
exports.modules = {

/***/ "(instrument)/./src/instrumentation.ts":
/*!********************************!*\
  !*** ./src/instrumentation.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   register: () => (/* binding */ register)\n/* harmony export */ });\nasync function register() {\n    if (true) {\n        // We only want to reconnect Telegram instances in the Node.js runtime,\n        // not in the Edge runtime.\n        const { telegramManager } = await __webpack_require__.e(/*! import() */ \"_instrument_src_lib_telegram_client_ts\").then(__webpack_require__.bind(__webpack_require__, /*! ./lib/telegram/client */ \"(instrument)/./src/lib/telegram/client.ts\"));\n        try {\n            // Reconnect all previously connected instances on startup\n            await telegramManager.reconnectAll();\n        } catch (err) {\n            console.error('[Instrumentation] Error during reconnectAll:', err);\n        }\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGluc3RydW1lbnQpLy4vc3JjL2luc3RydW1lbnRhdGlvbi50cyIsIm1hcHBpbmdzIjoiOzs7O0FBQU8sZUFBZUE7SUFDcEIsSUFBSUMsSUFBcUMsRUFBRTtRQUN6Qyx1RUFBdUU7UUFDdkUsMkJBQTJCO1FBQzNCLE1BQU0sRUFBRUcsZUFBZSxFQUFFLEdBQUcsTUFBTSw2TUFBK0I7UUFFakUsSUFBSTtZQUNGLDBEQUEwRDtZQUMxRCxNQUFNQSxnQkFBZ0JDLFlBQVk7UUFDcEMsRUFBRSxPQUFPQyxLQUFLO1lBQ1pDLFFBQVFDLEtBQUssQ0FBQyxnREFBZ0RGO1FBQ2hFO0lBQ0Y7QUFDRiIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxhcm1hblxcRGVza3RvcFxcTWV1cyBQcm9qZXRvc1xcdGVsZWdyYW0taW5zdGFuY2UtbWFuYWdlclxcc3JjXFxpbnN0cnVtZW50YXRpb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlZ2lzdGVyKCkge1xuICBpZiAocHJvY2Vzcy5lbnYuTkVYVF9SVU5USU1FID09PSAnbm9kZWpzJykge1xuICAgIC8vIFdlIG9ubHkgd2FudCB0byByZWNvbm5lY3QgVGVsZWdyYW0gaW5zdGFuY2VzIGluIHRoZSBOb2RlLmpzIHJ1bnRpbWUsXG4gICAgLy8gbm90IGluIHRoZSBFZGdlIHJ1bnRpbWUuXG4gICAgY29uc3QgeyB0ZWxlZ3JhbU1hbmFnZXIgfSA9IGF3YWl0IGltcG9ydCgnLi9saWIvdGVsZWdyYW0vY2xpZW50Jyk7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIFJlY29ubmVjdCBhbGwgcHJldmlvdXNseSBjb25uZWN0ZWQgaW5zdGFuY2VzIG9uIHN0YXJ0dXBcbiAgICAgIGF3YWl0IHRlbGVncmFtTWFuYWdlci5yZWNvbm5lY3RBbGwoKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tJbnN0cnVtZW50YXRpb25dIEVycm9yIGR1cmluZyByZWNvbm5lY3RBbGw6JywgZXJyKTtcbiAgICB9XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJyZWdpc3RlciIsInByb2Nlc3MiLCJlbnYiLCJORVhUX1JVTlRJTUUiLCJ0ZWxlZ3JhbU1hbmFnZXIiLCJyZWNvbm5lY3RBbGwiLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(instrument)/./src/instrumentation.ts\n");

/***/ }),

/***/ "@prisma/client":
/*!*********************************!*\
  !*** external "@prisma/client" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),

/***/ "telegram":
/*!***************************!*\
  !*** external "telegram" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("telegram");

/***/ }),

/***/ "telegram/events/EditedMessage":
/*!************************************************!*\
  !*** external "telegram/events/EditedMessage" ***!
  \************************************************/
/***/ ((module) => {

module.exports = require("telegram/events/EditedMessage");

/***/ }),

/***/ "telegram/events/NewMessage":
/*!*********************************************!*\
  !*** external "telegram/events/NewMessage" ***!
  \*********************************************/
/***/ ((module) => {

module.exports = require("telegram/events/NewMessage");

/***/ }),

/***/ "telegram/events/Raw":
/*!**************************************!*\
  !*** external "telegram/events/Raw" ***!
  \**************************************/
/***/ ((module) => {

module.exports = require("telegram/events/Raw");

/***/ }),

/***/ "telegram/extensions/Logger":
/*!*********************************************!*\
  !*** external "telegram/extensions/Logger" ***!
  \*********************************************/
/***/ ((module) => {

module.exports = require("telegram/extensions/Logger");

/***/ }),

/***/ "telegram/sessions":
/*!************************************!*\
  !*** external "telegram/sessions" ***!
  \************************************/
/***/ ((module) => {

module.exports = require("telegram/sessions");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("./webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__("(instrument)/./src/instrumentation.ts"));
module.exports = __webpack_exports__;

})();