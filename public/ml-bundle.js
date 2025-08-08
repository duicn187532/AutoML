(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/is-any-array/lib/index.js
  var require_lib = __commonJS({
    "node_modules/is-any-array/lib/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.isAnyArray = void 0;
      var toString = Object.prototype.toString;
      function isAnyArray4(value) {
        const tag = toString.call(value);
        return tag.endsWith("Array]") && !tag.includes("Big");
      }
      exports.isAnyArray = isAnyArray4;
    }
  });

  // node_modules/ml-array-max/lib/index.js
  var require_lib2 = __commonJS({
    "node_modules/ml-array-max/lib/index.js"(exports, module) {
      "use strict";
      var isAnyArray4 = require_lib();
      function max(input, options = {}) {
        if (!isAnyArray4.isAnyArray(input)) {
          throw new TypeError("input must be an array");
        }
        if (input.length === 0) {
          throw new TypeError("input must not be empty");
        }
        const { fromIndex = 0, toIndex = input.length } = options;
        if (fromIndex < 0 || fromIndex >= input.length || !Number.isInteger(fromIndex)) {
          throw new Error("fromIndex must be a positive integer smaller than length");
        }
        if (toIndex <= fromIndex || toIndex > input.length || !Number.isInteger(toIndex)) {
          throw new Error(
            "toIndex must be an integer greater than fromIndex and at most equal to length"
          );
        }
        let maxValue = input[fromIndex];
        for (let i = fromIndex + 1; i < toIndex; i++) {
          if (input[i] > maxValue) maxValue = input[i];
        }
        return maxValue;
      }
      module.exports = max;
    }
  });

  // node_modules/ml-array-min/lib/index.js
  var require_lib3 = __commonJS({
    "node_modules/ml-array-min/lib/index.js"(exports, module) {
      "use strict";
      var isAnyArray4 = require_lib();
      function min(input, options = {}) {
        if (!isAnyArray4.isAnyArray(input)) {
          throw new TypeError("input must be an array");
        }
        if (input.length === 0) {
          throw new TypeError("input must not be empty");
        }
        const { fromIndex = 0, toIndex = input.length } = options;
        if (fromIndex < 0 || fromIndex >= input.length || !Number.isInteger(fromIndex)) {
          throw new Error("fromIndex must be a positive integer smaller than length");
        }
        if (toIndex <= fromIndex || toIndex > input.length || !Number.isInteger(toIndex)) {
          throw new Error(
            "toIndex must be an integer greater than fromIndex and at most equal to length"
          );
        }
        let minValue = input[fromIndex];
        for (let i = fromIndex + 1; i < toIndex; i++) {
          if (input[i] < minValue) minValue = input[i];
        }
        return minValue;
      }
      module.exports = min;
    }
  });

  // node_modules/ml-array-rescale/lib/index.js
  var require_lib4 = __commonJS({
    "node_modules/ml-array-rescale/lib/index.js"(exports, module) {
      "use strict";
      var isAnyArray4 = require_lib();
      var max = require_lib2();
      var min = require_lib3();
      function _interopDefaultLegacy(e) {
        return e && typeof e === "object" && "default" in e ? e : { "default": e };
      }
      var max__default = /* @__PURE__ */ _interopDefaultLegacy(max);
      var min__default = /* @__PURE__ */ _interopDefaultLegacy(min);
      function rescale(input, options = {}) {
        if (!isAnyArray4.isAnyArray(input)) {
          throw new TypeError("input must be an array");
        } else if (input.length === 0) {
          throw new TypeError("input must not be empty");
        }
        let output;
        if (options.output !== void 0) {
          if (!isAnyArray4.isAnyArray(options.output)) {
            throw new TypeError("output option must be an array if specified");
          }
          output = options.output;
        } else {
          output = new Array(input.length);
        }
        const currentMin = min__default["default"](input);
        const currentMax = max__default["default"](input);
        if (currentMin === currentMax) {
          throw new RangeError(
            "minimum and maximum input values are equal. Cannot rescale a constant array"
          );
        }
        const {
          min: minValue = options.autoMinMax ? currentMin : 0,
          max: maxValue = options.autoMinMax ? currentMax : 1
        } = options;
        if (minValue >= maxValue) {
          throw new RangeError("min option must be smaller than max option");
        }
        const factor = (maxValue - minValue) / (currentMax - currentMin);
        for (let i = 0; i < input.length; i++) {
          output[i] = (input[i] - currentMin) * factor + minValue;
        }
        return output;
      }
      module.exports = rescale;
    }
  });

  // node_modules/ml-matrix/matrix.js
  var require_matrix = __commonJS({
    "node_modules/ml-matrix/matrix.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var isAnyArray4 = require_lib();
      var rescale = require_lib4();
      var indent = " ".repeat(2);
      var indentData = " ".repeat(4);
      function inspectMatrix() {
        return inspectMatrixWithOptions(this);
      }
      function inspectMatrixWithOptions(matrix2, options = {}) {
        const {
          maxRows = 15,
          maxColumns = 10,
          maxNumSize = 8,
          padMinus = "auto"
        } = options;
        return `${matrix2.constructor.name} {
${indent}[
${indentData}${inspectData(matrix2, maxRows, maxColumns, maxNumSize, padMinus)}
${indent}]
${indent}rows: ${matrix2.rows}
${indent}columns: ${matrix2.columns}
}`;
      }
      function inspectData(matrix2, maxRows, maxColumns, maxNumSize, padMinus) {
        const { rows, columns } = matrix2;
        const maxI = Math.min(rows, maxRows);
        const maxJ = Math.min(columns, maxColumns);
        const result = [];
        if (padMinus === "auto") {
          padMinus = false;
          loop: for (let i = 0; i < maxI; i++) {
            for (let j = 0; j < maxJ; j++) {
              if (matrix2.get(i, j) < 0) {
                padMinus = true;
                break loop;
              }
            }
          }
        }
        for (let i = 0; i < maxI; i++) {
          let line = [];
          for (let j = 0; j < maxJ; j++) {
            line.push(formatNumber(matrix2.get(i, j), maxNumSize, padMinus));
          }
          result.push(`${line.join(" ")}`);
        }
        if (maxJ !== columns) {
          result[result.length - 1] += ` ... ${columns - maxColumns} more columns`;
        }
        if (maxI !== rows) {
          result.push(`... ${rows - maxRows} more rows`);
        }
        return result.join(`
${indentData}`);
      }
      function formatNumber(num, maxNumSize, padMinus) {
        return (num >= 0 && padMinus ? ` ${formatNumber2(num, maxNumSize - 1)}` : formatNumber2(num, maxNumSize)).padEnd(maxNumSize);
      }
      function formatNumber2(num, len) {
        let str = num.toString();
        if (str.length <= len) return str;
        let fix = num.toFixed(len);
        if (fix.length > len) {
          fix = num.toFixed(Math.max(0, len - (fix.length - len)));
        }
        if (fix.length <= len && !fix.startsWith("0.000") && !fix.startsWith("-0.000")) {
          return fix;
        }
        let exp = num.toExponential(len);
        if (exp.length > len) {
          exp = num.toExponential(Math.max(0, len - (exp.length - len)));
        }
        return exp.slice(0);
      }
      function installMathOperations(AbstractMatrix3, Matrix4) {
        AbstractMatrix3.prototype.add = function add2(value) {
          if (typeof value === "number") return this.addS(value);
          return this.addM(value);
        };
        AbstractMatrix3.prototype.addS = function addS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) + value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.addM = function addM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) + matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.add = function add2(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.add(value);
        };
        AbstractMatrix3.prototype.sub = function sub(value) {
          if (typeof value === "number") return this.subS(value);
          return this.subM(value);
        };
        AbstractMatrix3.prototype.subS = function subS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) - value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.subM = function subM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) - matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.sub = function sub(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.sub(value);
        };
        AbstractMatrix3.prototype.subtract = AbstractMatrix3.prototype.sub;
        AbstractMatrix3.prototype.subtractS = AbstractMatrix3.prototype.subS;
        AbstractMatrix3.prototype.subtractM = AbstractMatrix3.prototype.subM;
        AbstractMatrix3.subtract = AbstractMatrix3.sub;
        AbstractMatrix3.prototype.mul = function mul(value) {
          if (typeof value === "number") return this.mulS(value);
          return this.mulM(value);
        };
        AbstractMatrix3.prototype.mulS = function mulS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) * value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.mulM = function mulM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) * matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.mul = function mul(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.mul(value);
        };
        AbstractMatrix3.prototype.multiply = AbstractMatrix3.prototype.mul;
        AbstractMatrix3.prototype.multiplyS = AbstractMatrix3.prototype.mulS;
        AbstractMatrix3.prototype.multiplyM = AbstractMatrix3.prototype.mulM;
        AbstractMatrix3.multiply = AbstractMatrix3.mul;
        AbstractMatrix3.prototype.div = function div(value) {
          if (typeof value === "number") return this.divS(value);
          return this.divM(value);
        };
        AbstractMatrix3.prototype.divS = function divS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) / value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.divM = function divM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) / matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.div = function div(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.div(value);
        };
        AbstractMatrix3.prototype.divide = AbstractMatrix3.prototype.div;
        AbstractMatrix3.prototype.divideS = AbstractMatrix3.prototype.divS;
        AbstractMatrix3.prototype.divideM = AbstractMatrix3.prototype.divM;
        AbstractMatrix3.divide = AbstractMatrix3.div;
        AbstractMatrix3.prototype.mod = function mod(value) {
          if (typeof value === "number") return this.modS(value);
          return this.modM(value);
        };
        AbstractMatrix3.prototype.modS = function modS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) % value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.modM = function modM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) % matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.mod = function mod(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.mod(value);
        };
        AbstractMatrix3.prototype.modulus = AbstractMatrix3.prototype.mod;
        AbstractMatrix3.prototype.modulusS = AbstractMatrix3.prototype.modS;
        AbstractMatrix3.prototype.modulusM = AbstractMatrix3.prototype.modM;
        AbstractMatrix3.modulus = AbstractMatrix3.mod;
        AbstractMatrix3.prototype.and = function and(value) {
          if (typeof value === "number") return this.andS(value);
          return this.andM(value);
        };
        AbstractMatrix3.prototype.andS = function andS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) & value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.andM = function andM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) & matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.and = function and(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.and(value);
        };
        AbstractMatrix3.prototype.or = function or(value) {
          if (typeof value === "number") return this.orS(value);
          return this.orM(value);
        };
        AbstractMatrix3.prototype.orS = function orS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) | value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.orM = function orM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) | matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.or = function or(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.or(value);
        };
        AbstractMatrix3.prototype.xor = function xor(value) {
          if (typeof value === "number") return this.xorS(value);
          return this.xorM(value);
        };
        AbstractMatrix3.prototype.xorS = function xorS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) ^ value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.xorM = function xorM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) ^ matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.xor = function xor(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.xor(value);
        };
        AbstractMatrix3.prototype.leftShift = function leftShift(value) {
          if (typeof value === "number") return this.leftShiftS(value);
          return this.leftShiftM(value);
        };
        AbstractMatrix3.prototype.leftShiftS = function leftShiftS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) << value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.leftShiftM = function leftShiftM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) << matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.leftShift = function leftShift(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.leftShift(value);
        };
        AbstractMatrix3.prototype.signPropagatingRightShift = function signPropagatingRightShift(value) {
          if (typeof value === "number") return this.signPropagatingRightShiftS(value);
          return this.signPropagatingRightShiftM(value);
        };
        AbstractMatrix3.prototype.signPropagatingRightShiftS = function signPropagatingRightShiftS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) >> value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.signPropagatingRightShiftM = function signPropagatingRightShiftM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) >> matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.signPropagatingRightShift = function signPropagatingRightShift(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.signPropagatingRightShift(value);
        };
        AbstractMatrix3.prototype.rightShift = function rightShift(value) {
          if (typeof value === "number") return this.rightShiftS(value);
          return this.rightShiftM(value);
        };
        AbstractMatrix3.prototype.rightShiftS = function rightShiftS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) >>> value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.rightShiftM = function rightShiftM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) >>> matrix2.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.rightShift = function rightShift(matrix2, value) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.rightShift(value);
        };
        AbstractMatrix3.prototype.zeroFillRightShift = AbstractMatrix3.prototype.rightShift;
        AbstractMatrix3.prototype.zeroFillRightShiftS = AbstractMatrix3.prototype.rightShiftS;
        AbstractMatrix3.prototype.zeroFillRightShiftM = AbstractMatrix3.prototype.rightShiftM;
        AbstractMatrix3.zeroFillRightShift = AbstractMatrix3.rightShift;
        AbstractMatrix3.prototype.not = function not() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, ~this.get(i, j));
            }
          }
          return this;
        };
        AbstractMatrix3.not = function not(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.not();
        };
        AbstractMatrix3.prototype.abs = function abs() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.abs(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.abs = function abs(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.abs();
        };
        AbstractMatrix3.prototype.acos = function acos() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.acos(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.acos = function acos(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.acos();
        };
        AbstractMatrix3.prototype.acosh = function acosh() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.acosh(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.acosh = function acosh(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.acosh();
        };
        AbstractMatrix3.prototype.asin = function asin() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.asin(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.asin = function asin(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.asin();
        };
        AbstractMatrix3.prototype.asinh = function asinh() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.asinh(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.asinh = function asinh(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.asinh();
        };
        AbstractMatrix3.prototype.atan = function atan() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.atan(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.atan = function atan(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.atan();
        };
        AbstractMatrix3.prototype.atanh = function atanh() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.atanh(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.atanh = function atanh(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.atanh();
        };
        AbstractMatrix3.prototype.cbrt = function cbrt() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.cbrt(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.cbrt = function cbrt(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.cbrt();
        };
        AbstractMatrix3.prototype.ceil = function ceil() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.ceil(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.ceil = function ceil(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.ceil();
        };
        AbstractMatrix3.prototype.clz32 = function clz32() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.clz32(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.clz32 = function clz32(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.clz32();
        };
        AbstractMatrix3.prototype.cos = function cos() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.cos(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.cos = function cos(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.cos();
        };
        AbstractMatrix3.prototype.cosh = function cosh() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.cosh(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.cosh = function cosh(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.cosh();
        };
        AbstractMatrix3.prototype.exp = function exp() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.exp(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.exp = function exp(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.exp();
        };
        AbstractMatrix3.prototype.expm1 = function expm1() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.expm1(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.expm1 = function expm1(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.expm1();
        };
        AbstractMatrix3.prototype.floor = function floor() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.floor(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.floor = function floor(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.floor();
        };
        AbstractMatrix3.prototype.fround = function fround() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.fround(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.fround = function fround(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.fround();
        };
        AbstractMatrix3.prototype.log = function log() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.log(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.log = function log(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.log();
        };
        AbstractMatrix3.prototype.log1p = function log1p() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.log1p(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.log1p = function log1p(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.log1p();
        };
        AbstractMatrix3.prototype.log10 = function log10() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.log10(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.log10 = function log10(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.log10();
        };
        AbstractMatrix3.prototype.log2 = function log2() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.log2(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.log2 = function log2(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.log2();
        };
        AbstractMatrix3.prototype.round = function round() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.round(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.round = function round(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.round();
        };
        AbstractMatrix3.prototype.sign = function sign() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.sign(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.sign = function sign(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.sign();
        };
        AbstractMatrix3.prototype.sin = function sin() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.sin(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.sin = function sin(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.sin();
        };
        AbstractMatrix3.prototype.sinh = function sinh() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.sinh(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.sinh = function sinh(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.sinh();
        };
        AbstractMatrix3.prototype.sqrt = function sqrt() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.sqrt(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.sqrt = function sqrt(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.sqrt();
        };
        AbstractMatrix3.prototype.tan = function tan() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.tan(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.tan = function tan(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.tan();
        };
        AbstractMatrix3.prototype.tanh = function tanh() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.tanh(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.tanh = function tanh(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.tanh();
        };
        AbstractMatrix3.prototype.trunc = function trunc() {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, Math.trunc(this.get(i, j)));
            }
          }
          return this;
        };
        AbstractMatrix3.trunc = function trunc(matrix2) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.trunc();
        };
        AbstractMatrix3.pow = function pow(matrix2, arg0) {
          const newMatrix = new Matrix4(matrix2);
          return newMatrix.pow(arg0);
        };
        AbstractMatrix3.prototype.pow = function pow(value) {
          if (typeof value === "number") return this.powS(value);
          return this.powM(value);
        };
        AbstractMatrix3.prototype.powS = function powS(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) ** value);
            }
          }
          return this;
        };
        AbstractMatrix3.prototype.powM = function powM(matrix2) {
          matrix2 = Matrix4.checkMatrix(matrix2);
          if (this.rows !== matrix2.rows || this.columns !== matrix2.columns) {
            throw new RangeError("Matrices dimensions must be equal");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) ** matrix2.get(i, j));
            }
          }
          return this;
        };
      }
      function checkRowIndex(matrix2, index, outer) {
        let max = outer ? matrix2.rows : matrix2.rows - 1;
        if (index < 0 || index > max) {
          throw new RangeError("Row index out of range");
        }
      }
      function checkColumnIndex(matrix2, index, outer) {
        let max = outer ? matrix2.columns : matrix2.columns - 1;
        if (index < 0 || index > max) {
          throw new RangeError("Column index out of range");
        }
      }
      function checkRowVector(matrix2, vector) {
        if (vector.to1DArray) {
          vector = vector.to1DArray();
        }
        if (vector.length !== matrix2.columns) {
          throw new RangeError(
            "vector size must be the same as the number of columns"
          );
        }
        return vector;
      }
      function checkColumnVector(matrix2, vector) {
        if (vector.to1DArray) {
          vector = vector.to1DArray();
        }
        if (vector.length !== matrix2.rows) {
          throw new RangeError("vector size must be the same as the number of rows");
        }
        return vector;
      }
      function checkRowIndices(matrix2, rowIndices) {
        if (!isAnyArray4.isAnyArray(rowIndices)) {
          throw new TypeError("row indices must be an array");
        }
        for (let i = 0; i < rowIndices.length; i++) {
          if (rowIndices[i] < 0 || rowIndices[i] >= matrix2.rows) {
            throw new RangeError("row indices are out of range");
          }
        }
      }
      function checkColumnIndices(matrix2, columnIndices) {
        if (!isAnyArray4.isAnyArray(columnIndices)) {
          throw new TypeError("column indices must be an array");
        }
        for (let i = 0; i < columnIndices.length; i++) {
          if (columnIndices[i] < 0 || columnIndices[i] >= matrix2.columns) {
            throw new RangeError("column indices are out of range");
          }
        }
      }
      function checkRange(matrix2, startRow, endRow, startColumn, endColumn) {
        if (arguments.length !== 5) {
          throw new RangeError("expected 4 arguments");
        }
        checkNumber("startRow", startRow);
        checkNumber("endRow", endRow);
        checkNumber("startColumn", startColumn);
        checkNumber("endColumn", endColumn);
        if (startRow > endRow || startColumn > endColumn || startRow < 0 || startRow >= matrix2.rows || endRow < 0 || endRow >= matrix2.rows || startColumn < 0 || startColumn >= matrix2.columns || endColumn < 0 || endColumn >= matrix2.columns) {
          throw new RangeError("Submatrix indices are out of range");
        }
      }
      function newArray(length, value = 0) {
        let array = [];
        for (let i = 0; i < length; i++) {
          array.push(value);
        }
        return array;
      }
      function checkNumber(name, value) {
        if (typeof value !== "number") {
          throw new TypeError(`${name} must be a number`);
        }
      }
      function checkNonEmpty(matrix2) {
        if (matrix2.isEmpty()) {
          throw new Error("Empty matrix has no elements to index");
        }
      }
      function sumByRow(matrix2) {
        let sum2 = newArray(matrix2.rows);
        for (let i = 0; i < matrix2.rows; ++i) {
          for (let j = 0; j < matrix2.columns; ++j) {
            sum2[i] += matrix2.get(i, j);
          }
        }
        return sum2;
      }
      function sumByColumn(matrix2) {
        let sum2 = newArray(matrix2.columns);
        for (let i = 0; i < matrix2.rows; ++i) {
          for (let j = 0; j < matrix2.columns; ++j) {
            sum2[j] += matrix2.get(i, j);
          }
        }
        return sum2;
      }
      function sumAll(matrix2) {
        let v = 0;
        for (let i = 0; i < matrix2.rows; i++) {
          for (let j = 0; j < matrix2.columns; j++) {
            v += matrix2.get(i, j);
          }
        }
        return v;
      }
      function productByRow(matrix2) {
        let sum2 = newArray(matrix2.rows, 1);
        for (let i = 0; i < matrix2.rows; ++i) {
          for (let j = 0; j < matrix2.columns; ++j) {
            sum2[i] *= matrix2.get(i, j);
          }
        }
        return sum2;
      }
      function productByColumn(matrix2) {
        let sum2 = newArray(matrix2.columns, 1);
        for (let i = 0; i < matrix2.rows; ++i) {
          for (let j = 0; j < matrix2.columns; ++j) {
            sum2[j] *= matrix2.get(i, j);
          }
        }
        return sum2;
      }
      function productAll(matrix2) {
        let v = 1;
        for (let i = 0; i < matrix2.rows; i++) {
          for (let j = 0; j < matrix2.columns; j++) {
            v *= matrix2.get(i, j);
          }
        }
        return v;
      }
      function varianceByRow(matrix2, unbiased, mean3) {
        const rows = matrix2.rows;
        const cols = matrix2.columns;
        const variance = [];
        for (let i = 0; i < rows; i++) {
          let sum1 = 0;
          let sum2 = 0;
          let x = 0;
          for (let j = 0; j < cols; j++) {
            x = matrix2.get(i, j) - mean3[i];
            sum1 += x;
            sum2 += x * x;
          }
          if (unbiased) {
            variance.push((sum2 - sum1 * sum1 / cols) / (cols - 1));
          } else {
            variance.push((sum2 - sum1 * sum1 / cols) / cols);
          }
        }
        return variance;
      }
      function varianceByColumn(matrix2, unbiased, mean3) {
        const rows = matrix2.rows;
        const cols = matrix2.columns;
        const variance = [];
        for (let j = 0; j < cols; j++) {
          let sum1 = 0;
          let sum2 = 0;
          let x = 0;
          for (let i = 0; i < rows; i++) {
            x = matrix2.get(i, j) - mean3[j];
            sum1 += x;
            sum2 += x * x;
          }
          if (unbiased) {
            variance.push((sum2 - sum1 * sum1 / rows) / (rows - 1));
          } else {
            variance.push((sum2 - sum1 * sum1 / rows) / rows);
          }
        }
        return variance;
      }
      function varianceAll(matrix2, unbiased, mean3) {
        const rows = matrix2.rows;
        const cols = matrix2.columns;
        const size = rows * cols;
        let sum1 = 0;
        let sum2 = 0;
        let x = 0;
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            x = matrix2.get(i, j) - mean3;
            sum1 += x;
            sum2 += x * x;
          }
        }
        if (unbiased) {
          return (sum2 - sum1 * sum1 / size) / (size - 1);
        } else {
          return (sum2 - sum1 * sum1 / size) / size;
        }
      }
      function centerByRow(matrix2, mean3) {
        for (let i = 0; i < matrix2.rows; i++) {
          for (let j = 0; j < matrix2.columns; j++) {
            matrix2.set(i, j, matrix2.get(i, j) - mean3[i]);
          }
        }
      }
      function centerByColumn(matrix2, mean3) {
        for (let i = 0; i < matrix2.rows; i++) {
          for (let j = 0; j < matrix2.columns; j++) {
            matrix2.set(i, j, matrix2.get(i, j) - mean3[j]);
          }
        }
      }
      function centerAll(matrix2, mean3) {
        for (let i = 0; i < matrix2.rows; i++) {
          for (let j = 0; j < matrix2.columns; j++) {
            matrix2.set(i, j, matrix2.get(i, j) - mean3);
          }
        }
      }
      function getScaleByRow(matrix2) {
        const scale = [];
        for (let i = 0; i < matrix2.rows; i++) {
          let sum2 = 0;
          for (let j = 0; j < matrix2.columns; j++) {
            sum2 += matrix2.get(i, j) ** 2 / (matrix2.columns - 1);
          }
          scale.push(Math.sqrt(sum2));
        }
        return scale;
      }
      function scaleByRow(matrix2, scale) {
        for (let i = 0; i < matrix2.rows; i++) {
          for (let j = 0; j < matrix2.columns; j++) {
            matrix2.set(i, j, matrix2.get(i, j) / scale[i]);
          }
        }
      }
      function getScaleByColumn(matrix2) {
        const scale = [];
        for (let j = 0; j < matrix2.columns; j++) {
          let sum2 = 0;
          for (let i = 0; i < matrix2.rows; i++) {
            sum2 += matrix2.get(i, j) ** 2 / (matrix2.rows - 1);
          }
          scale.push(Math.sqrt(sum2));
        }
        return scale;
      }
      function scaleByColumn(matrix2, scale) {
        for (let i = 0; i < matrix2.rows; i++) {
          for (let j = 0; j < matrix2.columns; j++) {
            matrix2.set(i, j, matrix2.get(i, j) / scale[j]);
          }
        }
      }
      function getScaleAll(matrix2) {
        const divider = matrix2.size - 1;
        let sum2 = 0;
        for (let j = 0; j < matrix2.columns; j++) {
          for (let i = 0; i < matrix2.rows; i++) {
            sum2 += matrix2.get(i, j) ** 2 / divider;
          }
        }
        return Math.sqrt(sum2);
      }
      function scaleAll(matrix2, scale) {
        for (let i = 0; i < matrix2.rows; i++) {
          for (let j = 0; j < matrix2.columns; j++) {
            matrix2.set(i, j, matrix2.get(i, j) / scale);
          }
        }
      }
      var AbstractMatrix2 = class _AbstractMatrix {
        static from1DArray(newRows, newColumns, newData) {
          let length = newRows * newColumns;
          if (length !== newData.length) {
            throw new RangeError("data length does not match given dimensions");
          }
          let newMatrix = new Matrix3(newRows, newColumns);
          for (let row = 0; row < newRows; row++) {
            for (let column = 0; column < newColumns; column++) {
              newMatrix.set(row, column, newData[row * newColumns + column]);
            }
          }
          return newMatrix;
        }
        static rowVector(newData) {
          let vector = new Matrix3(1, newData.length);
          for (let i = 0; i < newData.length; i++) {
            vector.set(0, i, newData[i]);
          }
          return vector;
        }
        static columnVector(newData) {
          let vector = new Matrix3(newData.length, 1);
          for (let i = 0; i < newData.length; i++) {
            vector.set(i, 0, newData[i]);
          }
          return vector;
        }
        static zeros(rows, columns) {
          return new Matrix3(rows, columns);
        }
        static ones(rows, columns) {
          return new Matrix3(rows, columns).fill(1);
        }
        static rand(rows, columns, options = {}) {
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          const { random = Math.random } = options;
          let matrix2 = new Matrix3(rows, columns);
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              matrix2.set(i, j, random());
            }
          }
          return matrix2;
        }
        static randInt(rows, columns, options = {}) {
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          const { min = 0, max = 1e3, random = Math.random } = options;
          if (!Number.isInteger(min)) throw new TypeError("min must be an integer");
          if (!Number.isInteger(max)) throw new TypeError("max must be an integer");
          if (min >= max) throw new RangeError("min must be smaller than max");
          let interval = max - min;
          let matrix2 = new Matrix3(rows, columns);
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              let value = min + Math.round(random() * interval);
              matrix2.set(i, j, value);
            }
          }
          return matrix2;
        }
        static eye(rows, columns, value) {
          if (columns === void 0) columns = rows;
          if (value === void 0) value = 1;
          let min = Math.min(rows, columns);
          let matrix2 = this.zeros(rows, columns);
          for (let i = 0; i < min; i++) {
            matrix2.set(i, i, value);
          }
          return matrix2;
        }
        static diag(data, rows, columns) {
          let l = data.length;
          if (rows === void 0) rows = l;
          if (columns === void 0) columns = rows;
          let min = Math.min(l, rows, columns);
          let matrix2 = this.zeros(rows, columns);
          for (let i = 0; i < min; i++) {
            matrix2.set(i, i, data[i]);
          }
          return matrix2;
        }
        static min(matrix1, matrix2) {
          matrix1 = this.checkMatrix(matrix1);
          matrix2 = this.checkMatrix(matrix2);
          let rows = matrix1.rows;
          let columns = matrix1.columns;
          let result = new Matrix3(rows, columns);
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              result.set(i, j, Math.min(matrix1.get(i, j), matrix2.get(i, j)));
            }
          }
          return result;
        }
        static max(matrix1, matrix2) {
          matrix1 = this.checkMatrix(matrix1);
          matrix2 = this.checkMatrix(matrix2);
          let rows = matrix1.rows;
          let columns = matrix1.columns;
          let result = new this(rows, columns);
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              result.set(i, j, Math.max(matrix1.get(i, j), matrix2.get(i, j)));
            }
          }
          return result;
        }
        static checkMatrix(value) {
          return _AbstractMatrix.isMatrix(value) ? value : new Matrix3(value);
        }
        static isMatrix(value) {
          return value != null && value.klass === "Matrix";
        }
        get size() {
          return this.rows * this.columns;
        }
        apply(callback) {
          if (typeof callback !== "function") {
            throw new TypeError("callback must be a function");
          }
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              callback.call(this, i, j);
            }
          }
          return this;
        }
        to1DArray() {
          let array = [];
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              array.push(this.get(i, j));
            }
          }
          return array;
        }
        to2DArray() {
          let copy = [];
          for (let i = 0; i < this.rows; i++) {
            copy.push([]);
            for (let j = 0; j < this.columns; j++) {
              copy[i].push(this.get(i, j));
            }
          }
          return copy;
        }
        toJSON() {
          return this.to2DArray();
        }
        isRowVector() {
          return this.rows === 1;
        }
        isColumnVector() {
          return this.columns === 1;
        }
        isVector() {
          return this.rows === 1 || this.columns === 1;
        }
        isSquare() {
          return this.rows === this.columns;
        }
        isEmpty() {
          return this.rows === 0 || this.columns === 0;
        }
        isSymmetric() {
          if (this.isSquare()) {
            for (let i = 0; i < this.rows; i++) {
              for (let j = 0; j <= i; j++) {
                if (this.get(i, j) !== this.get(j, i)) {
                  return false;
                }
              }
            }
            return true;
          }
          return false;
        }
        isDistance() {
          if (!this.isSymmetric()) return false;
          for (let i = 0; i < this.rows; i++) {
            if (this.get(i, i) !== 0) return false;
          }
          return true;
        }
        isEchelonForm() {
          let i = 0;
          let j = 0;
          let previousColumn = -1;
          let isEchelonForm = true;
          let checked = false;
          while (i < this.rows && isEchelonForm) {
            j = 0;
            checked = false;
            while (j < this.columns && checked === false) {
              if (this.get(i, j) === 0) {
                j++;
              } else if (this.get(i, j) === 1 && j > previousColumn) {
                checked = true;
                previousColumn = j;
              } else {
                isEchelonForm = false;
                checked = true;
              }
            }
            i++;
          }
          return isEchelonForm;
        }
        isReducedEchelonForm() {
          let i = 0;
          let j = 0;
          let previousColumn = -1;
          let isReducedEchelonForm = true;
          let checked = false;
          while (i < this.rows && isReducedEchelonForm) {
            j = 0;
            checked = false;
            while (j < this.columns && checked === false) {
              if (this.get(i, j) === 0) {
                j++;
              } else if (this.get(i, j) === 1 && j > previousColumn) {
                checked = true;
                previousColumn = j;
              } else {
                isReducedEchelonForm = false;
                checked = true;
              }
            }
            for (let k = j + 1; k < this.rows; k++) {
              if (this.get(i, k) !== 0) {
                isReducedEchelonForm = false;
              }
            }
            i++;
          }
          return isReducedEchelonForm;
        }
        echelonForm() {
          let result = this.clone();
          let h = 0;
          let k = 0;
          while (h < result.rows && k < result.columns) {
            let iMax = h;
            for (let i = h; i < result.rows; i++) {
              if (result.get(i, k) > result.get(iMax, k)) {
                iMax = i;
              }
            }
            if (result.get(iMax, k) === 0) {
              k++;
            } else {
              result.swapRows(h, iMax);
              let tmp = result.get(h, k);
              for (let j = k; j < result.columns; j++) {
                result.set(h, j, result.get(h, j) / tmp);
              }
              for (let i = h + 1; i < result.rows; i++) {
                let factor = result.get(i, k) / result.get(h, k);
                result.set(i, k, 0);
                for (let j = k + 1; j < result.columns; j++) {
                  result.set(i, j, result.get(i, j) - result.get(h, j) * factor);
                }
              }
              h++;
              k++;
            }
          }
          return result;
        }
        reducedEchelonForm() {
          let result = this.echelonForm();
          let m = result.columns;
          let n = result.rows;
          let h = n - 1;
          while (h >= 0) {
            if (result.maxRow(h) === 0) {
              h--;
            } else {
              let p = 0;
              let pivot = false;
              while (p < n && pivot === false) {
                if (result.get(h, p) === 1) {
                  pivot = true;
                } else {
                  p++;
                }
              }
              for (let i = 0; i < h; i++) {
                let factor = result.get(i, p);
                for (let j = p; j < m; j++) {
                  let tmp = result.get(i, j) - factor * result.get(h, j);
                  result.set(i, j, tmp);
                }
              }
              h--;
            }
          }
          return result;
        }
        set() {
          throw new Error("set method is unimplemented");
        }
        get() {
          throw new Error("get method is unimplemented");
        }
        repeat(options = {}) {
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          const { rows = 1, columns = 1 } = options;
          if (!Number.isInteger(rows) || rows <= 0) {
            throw new TypeError("rows must be a positive integer");
          }
          if (!Number.isInteger(columns) || columns <= 0) {
            throw new TypeError("columns must be a positive integer");
          }
          let matrix2 = new Matrix3(this.rows * rows, this.columns * columns);
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              matrix2.setSubMatrix(this, this.rows * i, this.columns * j);
            }
          }
          return matrix2;
        }
        fill(value) {
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, value);
            }
          }
          return this;
        }
        neg() {
          return this.mulS(-1);
        }
        getRow(index) {
          checkRowIndex(this, index);
          let row = [];
          for (let i = 0; i < this.columns; i++) {
            row.push(this.get(index, i));
          }
          return row;
        }
        getRowVector(index) {
          return Matrix3.rowVector(this.getRow(index));
        }
        setRow(index, array) {
          checkRowIndex(this, index);
          array = checkRowVector(this, array);
          for (let i = 0; i < this.columns; i++) {
            this.set(index, i, array[i]);
          }
          return this;
        }
        swapRows(row1, row2) {
          checkRowIndex(this, row1);
          checkRowIndex(this, row2);
          for (let i = 0; i < this.columns; i++) {
            let temp = this.get(row1, i);
            this.set(row1, i, this.get(row2, i));
            this.set(row2, i, temp);
          }
          return this;
        }
        getColumn(index) {
          checkColumnIndex(this, index);
          let column = [];
          for (let i = 0; i < this.rows; i++) {
            column.push(this.get(i, index));
          }
          return column;
        }
        getColumnVector(index) {
          return Matrix3.columnVector(this.getColumn(index));
        }
        setColumn(index, array) {
          checkColumnIndex(this, index);
          array = checkColumnVector(this, array);
          for (let i = 0; i < this.rows; i++) {
            this.set(i, index, array[i]);
          }
          return this;
        }
        swapColumns(column1, column2) {
          checkColumnIndex(this, column1);
          checkColumnIndex(this, column2);
          for (let i = 0; i < this.rows; i++) {
            let temp = this.get(i, column1);
            this.set(i, column1, this.get(i, column2));
            this.set(i, column2, temp);
          }
          return this;
        }
        addRowVector(vector) {
          vector = checkRowVector(this, vector);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) + vector[j]);
            }
          }
          return this;
        }
        subRowVector(vector) {
          vector = checkRowVector(this, vector);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) - vector[j]);
            }
          }
          return this;
        }
        mulRowVector(vector) {
          vector = checkRowVector(this, vector);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) * vector[j]);
            }
          }
          return this;
        }
        divRowVector(vector) {
          vector = checkRowVector(this, vector);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) / vector[j]);
            }
          }
          return this;
        }
        addColumnVector(vector) {
          vector = checkColumnVector(this, vector);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) + vector[i]);
            }
          }
          return this;
        }
        subColumnVector(vector) {
          vector = checkColumnVector(this, vector);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) - vector[i]);
            }
          }
          return this;
        }
        mulColumnVector(vector) {
          vector = checkColumnVector(this, vector);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) * vector[i]);
            }
          }
          return this;
        }
        divColumnVector(vector) {
          vector = checkColumnVector(this, vector);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              this.set(i, j, this.get(i, j) / vector[i]);
            }
          }
          return this;
        }
        mulRow(index, value) {
          checkRowIndex(this, index);
          for (let i = 0; i < this.columns; i++) {
            this.set(index, i, this.get(index, i) * value);
          }
          return this;
        }
        mulColumn(index, value) {
          checkColumnIndex(this, index);
          for (let i = 0; i < this.rows; i++) {
            this.set(i, index, this.get(i, index) * value);
          }
          return this;
        }
        max(by) {
          if (this.isEmpty()) {
            return NaN;
          }
          switch (by) {
            case "row": {
              const max = new Array(this.rows).fill(Number.NEGATIVE_INFINITY);
              for (let row = 0; row < this.rows; row++) {
                for (let column = 0; column < this.columns; column++) {
                  if (this.get(row, column) > max[row]) {
                    max[row] = this.get(row, column);
                  }
                }
              }
              return max;
            }
            case "column": {
              const max = new Array(this.columns).fill(Number.NEGATIVE_INFINITY);
              for (let row = 0; row < this.rows; row++) {
                for (let column = 0; column < this.columns; column++) {
                  if (this.get(row, column) > max[column]) {
                    max[column] = this.get(row, column);
                  }
                }
              }
              return max;
            }
            case void 0: {
              let max = this.get(0, 0);
              for (let row = 0; row < this.rows; row++) {
                for (let column = 0; column < this.columns; column++) {
                  if (this.get(row, column) > max) {
                    max = this.get(row, column);
                  }
                }
              }
              return max;
            }
            default:
              throw new Error(`invalid option: ${by}`);
          }
        }
        maxIndex() {
          checkNonEmpty(this);
          let v = this.get(0, 0);
          let idx = [0, 0];
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              if (this.get(i, j) > v) {
                v = this.get(i, j);
                idx[0] = i;
                idx[1] = j;
              }
            }
          }
          return idx;
        }
        min(by) {
          if (this.isEmpty()) {
            return NaN;
          }
          switch (by) {
            case "row": {
              const min = new Array(this.rows).fill(Number.POSITIVE_INFINITY);
              for (let row = 0; row < this.rows; row++) {
                for (let column = 0; column < this.columns; column++) {
                  if (this.get(row, column) < min[row]) {
                    min[row] = this.get(row, column);
                  }
                }
              }
              return min;
            }
            case "column": {
              const min = new Array(this.columns).fill(Number.POSITIVE_INFINITY);
              for (let row = 0; row < this.rows; row++) {
                for (let column = 0; column < this.columns; column++) {
                  if (this.get(row, column) < min[column]) {
                    min[column] = this.get(row, column);
                  }
                }
              }
              return min;
            }
            case void 0: {
              let min = this.get(0, 0);
              for (let row = 0; row < this.rows; row++) {
                for (let column = 0; column < this.columns; column++) {
                  if (this.get(row, column) < min) {
                    min = this.get(row, column);
                  }
                }
              }
              return min;
            }
            default:
              throw new Error(`invalid option: ${by}`);
          }
        }
        minIndex() {
          checkNonEmpty(this);
          let v = this.get(0, 0);
          let idx = [0, 0];
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              if (this.get(i, j) < v) {
                v = this.get(i, j);
                idx[0] = i;
                idx[1] = j;
              }
            }
          }
          return idx;
        }
        maxRow(row) {
          checkRowIndex(this, row);
          if (this.isEmpty()) {
            return NaN;
          }
          let v = this.get(row, 0);
          for (let i = 1; i < this.columns; i++) {
            if (this.get(row, i) > v) {
              v = this.get(row, i);
            }
          }
          return v;
        }
        maxRowIndex(row) {
          checkRowIndex(this, row);
          checkNonEmpty(this);
          let v = this.get(row, 0);
          let idx = [row, 0];
          for (let i = 1; i < this.columns; i++) {
            if (this.get(row, i) > v) {
              v = this.get(row, i);
              idx[1] = i;
            }
          }
          return idx;
        }
        minRow(row) {
          checkRowIndex(this, row);
          if (this.isEmpty()) {
            return NaN;
          }
          let v = this.get(row, 0);
          for (let i = 1; i < this.columns; i++) {
            if (this.get(row, i) < v) {
              v = this.get(row, i);
            }
          }
          return v;
        }
        minRowIndex(row) {
          checkRowIndex(this, row);
          checkNonEmpty(this);
          let v = this.get(row, 0);
          let idx = [row, 0];
          for (let i = 1; i < this.columns; i++) {
            if (this.get(row, i) < v) {
              v = this.get(row, i);
              idx[1] = i;
            }
          }
          return idx;
        }
        maxColumn(column) {
          checkColumnIndex(this, column);
          if (this.isEmpty()) {
            return NaN;
          }
          let v = this.get(0, column);
          for (let i = 1; i < this.rows; i++) {
            if (this.get(i, column) > v) {
              v = this.get(i, column);
            }
          }
          return v;
        }
        maxColumnIndex(column) {
          checkColumnIndex(this, column);
          checkNonEmpty(this);
          let v = this.get(0, column);
          let idx = [0, column];
          for (let i = 1; i < this.rows; i++) {
            if (this.get(i, column) > v) {
              v = this.get(i, column);
              idx[0] = i;
            }
          }
          return idx;
        }
        minColumn(column) {
          checkColumnIndex(this, column);
          if (this.isEmpty()) {
            return NaN;
          }
          let v = this.get(0, column);
          for (let i = 1; i < this.rows; i++) {
            if (this.get(i, column) < v) {
              v = this.get(i, column);
            }
          }
          return v;
        }
        minColumnIndex(column) {
          checkColumnIndex(this, column);
          checkNonEmpty(this);
          let v = this.get(0, column);
          let idx = [0, column];
          for (let i = 1; i < this.rows; i++) {
            if (this.get(i, column) < v) {
              v = this.get(i, column);
              idx[0] = i;
            }
          }
          return idx;
        }
        diag() {
          let min = Math.min(this.rows, this.columns);
          let diag = [];
          for (let i = 0; i < min; i++) {
            diag.push(this.get(i, i));
          }
          return diag;
        }
        norm(type = "frobenius") {
          switch (type) {
            case "max":
              return this.max();
            case "frobenius":
              return Math.sqrt(this.dot(this));
            default:
              throw new RangeError(`unknown norm type: ${type}`);
          }
        }
        cumulativeSum() {
          let sum2 = 0;
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              sum2 += this.get(i, j);
              this.set(i, j, sum2);
            }
          }
          return this;
        }
        dot(vector2) {
          if (_AbstractMatrix.isMatrix(vector2)) vector2 = vector2.to1DArray();
          let vector1 = this.to1DArray();
          if (vector1.length !== vector2.length) {
            throw new RangeError("vectors do not have the same size");
          }
          let dot = 0;
          for (let i = 0; i < vector1.length; i++) {
            dot += vector1[i] * vector2[i];
          }
          return dot;
        }
        mmul(other) {
          other = Matrix3.checkMatrix(other);
          let m = this.rows;
          let n = this.columns;
          let p = other.columns;
          let result = new Matrix3(m, p);
          let Bcolj = new Float64Array(n);
          for (let j = 0; j < p; j++) {
            for (let k = 0; k < n; k++) {
              Bcolj[k] = other.get(k, j);
            }
            for (let i = 0; i < m; i++) {
              let s = 0;
              for (let k = 0; k < n; k++) {
                s += this.get(i, k) * Bcolj[k];
              }
              result.set(i, j, s);
            }
          }
          return result;
        }
        mpow(scalar) {
          if (!this.isSquare()) {
            throw new RangeError("Matrix must be square");
          }
          if (!Number.isInteger(scalar) || scalar < 0) {
            throw new RangeError("Exponent must be a non-negative integer");
          }
          let result = Matrix3.eye(this.rows);
          let bb = this;
          for (let e = scalar; e >= 1; e /= 2) {
            if ((e & 1) !== 0) {
              result = result.mmul(bb);
            }
            bb = bb.mmul(bb);
          }
          return result;
        }
        strassen2x2(other) {
          other = Matrix3.checkMatrix(other);
          let result = new Matrix3(2, 2);
          const a11 = this.get(0, 0);
          const b11 = other.get(0, 0);
          const a12 = this.get(0, 1);
          const b12 = other.get(0, 1);
          const a21 = this.get(1, 0);
          const b21 = other.get(1, 0);
          const a22 = this.get(1, 1);
          const b22 = other.get(1, 1);
          const m1 = (a11 + a22) * (b11 + b22);
          const m2 = (a21 + a22) * b11;
          const m3 = a11 * (b12 - b22);
          const m4 = a22 * (b21 - b11);
          const m5 = (a11 + a12) * b22;
          const m6 = (a21 - a11) * (b11 + b12);
          const m7 = (a12 - a22) * (b21 + b22);
          const c00 = m1 + m4 - m5 + m7;
          const c01 = m3 + m5;
          const c10 = m2 + m4;
          const c11 = m1 - m2 + m3 + m6;
          result.set(0, 0, c00);
          result.set(0, 1, c01);
          result.set(1, 0, c10);
          result.set(1, 1, c11);
          return result;
        }
        strassen3x3(other) {
          other = Matrix3.checkMatrix(other);
          let result = new Matrix3(3, 3);
          const a00 = this.get(0, 0);
          const a01 = this.get(0, 1);
          const a02 = this.get(0, 2);
          const a10 = this.get(1, 0);
          const a11 = this.get(1, 1);
          const a12 = this.get(1, 2);
          const a20 = this.get(2, 0);
          const a21 = this.get(2, 1);
          const a22 = this.get(2, 2);
          const b00 = other.get(0, 0);
          const b01 = other.get(0, 1);
          const b02 = other.get(0, 2);
          const b10 = other.get(1, 0);
          const b11 = other.get(1, 1);
          const b12 = other.get(1, 2);
          const b20 = other.get(2, 0);
          const b21 = other.get(2, 1);
          const b22 = other.get(2, 2);
          const m1 = (a00 + a01 + a02 - a10 - a11 - a21 - a22) * b11;
          const m2 = (a00 - a10) * (-b01 + b11);
          const m3 = a11 * (-b00 + b01 + b10 - b11 - b12 - b20 + b22);
          const m4 = (-a00 + a10 + a11) * (b00 - b01 + b11);
          const m5 = (a10 + a11) * (-b00 + b01);
          const m6 = a00 * b00;
          const m7 = (-a00 + a20 + a21) * (b00 - b02 + b12);
          const m8 = (-a00 + a20) * (b02 - b12);
          const m9 = (a20 + a21) * (-b00 + b02);
          const m10 = (a00 + a01 + a02 - a11 - a12 - a20 - a21) * b12;
          const m11 = a21 * (-b00 + b02 + b10 - b11 - b12 - b20 + b21);
          const m12 = (-a02 + a21 + a22) * (b11 + b20 - b21);
          const m13 = (a02 - a22) * (b11 - b21);
          const m14 = a02 * b20;
          const m15 = (a21 + a22) * (-b20 + b21);
          const m16 = (-a02 + a11 + a12) * (b12 + b20 - b22);
          const m17 = (a02 - a12) * (b12 - b22);
          const m18 = (a11 + a12) * (-b20 + b22);
          const m19 = a01 * b10;
          const m20 = a12 * b21;
          const m21 = a10 * b02;
          const m22 = a20 * b01;
          const m23 = a22 * b22;
          const c00 = m6 + m14 + m19;
          const c01 = m1 + m4 + m5 + m6 + m12 + m14 + m15;
          const c02 = m6 + m7 + m9 + m10 + m14 + m16 + m18;
          const c10 = m2 + m3 + m4 + m6 + m14 + m16 + m17;
          const c11 = m2 + m4 + m5 + m6 + m20;
          const c12 = m14 + m16 + m17 + m18 + m21;
          const c20 = m6 + m7 + m8 + m11 + m12 + m13 + m14;
          const c21 = m12 + m13 + m14 + m15 + m22;
          const c22 = m6 + m7 + m8 + m9 + m23;
          result.set(0, 0, c00);
          result.set(0, 1, c01);
          result.set(0, 2, c02);
          result.set(1, 0, c10);
          result.set(1, 1, c11);
          result.set(1, 2, c12);
          result.set(2, 0, c20);
          result.set(2, 1, c21);
          result.set(2, 2, c22);
          return result;
        }
        mmulStrassen(y) {
          y = Matrix3.checkMatrix(y);
          let x = this.clone();
          let r1 = x.rows;
          let c1 = x.columns;
          let r2 = y.rows;
          let c2 = y.columns;
          if (c1 !== r2) {
            console.warn(
              `Multiplying ${r1} x ${c1} and ${r2} x ${c2} matrix: dimensions do not match.`
            );
          }
          function embed(mat, rows, cols) {
            let r3 = mat.rows;
            let c3 = mat.columns;
            if (r3 === rows && c3 === cols) {
              return mat;
            } else {
              let resultat = _AbstractMatrix.zeros(rows, cols);
              resultat = resultat.setSubMatrix(mat, 0, 0);
              return resultat;
            }
          }
          let r = Math.max(r1, r2);
          let c = Math.max(c1, c2);
          x = embed(x, r, c);
          y = embed(y, r, c);
          function blockMult(a, b, rows, cols) {
            if (rows <= 512 || cols <= 512) {
              return a.mmul(b);
            }
            if (rows % 2 === 1 && cols % 2 === 1) {
              a = embed(a, rows + 1, cols + 1);
              b = embed(b, rows + 1, cols + 1);
            } else if (rows % 2 === 1) {
              a = embed(a, rows + 1, cols);
              b = embed(b, rows + 1, cols);
            } else if (cols % 2 === 1) {
              a = embed(a, rows, cols + 1);
              b = embed(b, rows, cols + 1);
            }
            let halfRows = parseInt(a.rows / 2, 10);
            let halfCols = parseInt(a.columns / 2, 10);
            let a11 = a.subMatrix(0, halfRows - 1, 0, halfCols - 1);
            let b11 = b.subMatrix(0, halfRows - 1, 0, halfCols - 1);
            let a12 = a.subMatrix(0, halfRows - 1, halfCols, a.columns - 1);
            let b12 = b.subMatrix(0, halfRows - 1, halfCols, b.columns - 1);
            let a21 = a.subMatrix(halfRows, a.rows - 1, 0, halfCols - 1);
            let b21 = b.subMatrix(halfRows, b.rows - 1, 0, halfCols - 1);
            let a22 = a.subMatrix(halfRows, a.rows - 1, halfCols, a.columns - 1);
            let b22 = b.subMatrix(halfRows, b.rows - 1, halfCols, b.columns - 1);
            let m1 = blockMult(
              _AbstractMatrix.add(a11, a22),
              _AbstractMatrix.add(b11, b22),
              halfRows,
              halfCols
            );
            let m2 = blockMult(_AbstractMatrix.add(a21, a22), b11, halfRows, halfCols);
            let m3 = blockMult(a11, _AbstractMatrix.sub(b12, b22), halfRows, halfCols);
            let m4 = blockMult(a22, _AbstractMatrix.sub(b21, b11), halfRows, halfCols);
            let m5 = blockMult(_AbstractMatrix.add(a11, a12), b22, halfRows, halfCols);
            let m6 = blockMult(
              _AbstractMatrix.sub(a21, a11),
              _AbstractMatrix.add(b11, b12),
              halfRows,
              halfCols
            );
            let m7 = blockMult(
              _AbstractMatrix.sub(a12, a22),
              _AbstractMatrix.add(b21, b22),
              halfRows,
              halfCols
            );
            let c11 = _AbstractMatrix.add(m1, m4);
            c11.sub(m5);
            c11.add(m7);
            let c12 = _AbstractMatrix.add(m3, m5);
            let c21 = _AbstractMatrix.add(m2, m4);
            let c22 = _AbstractMatrix.sub(m1, m2);
            c22.add(m3);
            c22.add(m6);
            let result = _AbstractMatrix.zeros(2 * c11.rows, 2 * c11.columns);
            result = result.setSubMatrix(c11, 0, 0);
            result = result.setSubMatrix(c12, c11.rows, 0);
            result = result.setSubMatrix(c21, 0, c11.columns);
            result = result.setSubMatrix(c22, c11.rows, c11.columns);
            return result.subMatrix(0, rows - 1, 0, cols - 1);
          }
          return blockMult(x, y, r, c);
        }
        scaleRows(options = {}) {
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          const { min = 0, max = 1 } = options;
          if (!Number.isFinite(min)) throw new TypeError("min must be a number");
          if (!Number.isFinite(max)) throw new TypeError("max must be a number");
          if (min >= max) throw new RangeError("min must be smaller than max");
          let newMatrix = new Matrix3(this.rows, this.columns);
          for (let i = 0; i < this.rows; i++) {
            const row = this.getRow(i);
            if (row.length > 0) {
              rescale(row, { min, max, output: row });
            }
            newMatrix.setRow(i, row);
          }
          return newMatrix;
        }
        scaleColumns(options = {}) {
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          const { min = 0, max = 1 } = options;
          if (!Number.isFinite(min)) throw new TypeError("min must be a number");
          if (!Number.isFinite(max)) throw new TypeError("max must be a number");
          if (min >= max) throw new RangeError("min must be smaller than max");
          let newMatrix = new Matrix3(this.rows, this.columns);
          for (let i = 0; i < this.columns; i++) {
            const column = this.getColumn(i);
            if (column.length) {
              rescale(column, {
                min,
                max,
                output: column
              });
            }
            newMatrix.setColumn(i, column);
          }
          return newMatrix;
        }
        flipRows() {
          const middle = Math.ceil(this.columns / 2);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < middle; j++) {
              let first = this.get(i, j);
              let last = this.get(i, this.columns - 1 - j);
              this.set(i, j, last);
              this.set(i, this.columns - 1 - j, first);
            }
          }
          return this;
        }
        flipColumns() {
          const middle = Math.ceil(this.rows / 2);
          for (let j = 0; j < this.columns; j++) {
            for (let i = 0; i < middle; i++) {
              let first = this.get(i, j);
              let last = this.get(this.rows - 1 - i, j);
              this.set(i, j, last);
              this.set(this.rows - 1 - i, j, first);
            }
          }
          return this;
        }
        kroneckerProduct(other) {
          other = Matrix3.checkMatrix(other);
          let m = this.rows;
          let n = this.columns;
          let p = other.rows;
          let q = other.columns;
          let result = new Matrix3(m * p, n * q);
          for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
              for (let k = 0; k < p; k++) {
                for (let l = 0; l < q; l++) {
                  result.set(p * i + k, q * j + l, this.get(i, j) * other.get(k, l));
                }
              }
            }
          }
          return result;
        }
        kroneckerSum(other) {
          other = Matrix3.checkMatrix(other);
          if (!this.isSquare() || !other.isSquare()) {
            throw new Error("Kronecker Sum needs two Square Matrices");
          }
          let m = this.rows;
          let n = other.rows;
          let AxI = this.kroneckerProduct(Matrix3.eye(n, n));
          let IxB = Matrix3.eye(m, m).kroneckerProduct(other);
          return AxI.add(IxB);
        }
        transpose() {
          let result = new Matrix3(this.columns, this.rows);
          for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
              result.set(j, i, this.get(i, j));
            }
          }
          return result;
        }
        sortRows(compareFunction = compareNumbers) {
          for (let i = 0; i < this.rows; i++) {
            this.setRow(i, this.getRow(i).sort(compareFunction));
          }
          return this;
        }
        sortColumns(compareFunction = compareNumbers) {
          for (let i = 0; i < this.columns; i++) {
            this.setColumn(i, this.getColumn(i).sort(compareFunction));
          }
          return this;
        }
        subMatrix(startRow, endRow, startColumn, endColumn) {
          checkRange(this, startRow, endRow, startColumn, endColumn);
          let newMatrix = new Matrix3(
            endRow - startRow + 1,
            endColumn - startColumn + 1
          );
          for (let i = startRow; i <= endRow; i++) {
            for (let j = startColumn; j <= endColumn; j++) {
              newMatrix.set(i - startRow, j - startColumn, this.get(i, j));
            }
          }
          return newMatrix;
        }
        subMatrixRow(indices, startColumn, endColumn) {
          if (startColumn === void 0) startColumn = 0;
          if (endColumn === void 0) endColumn = this.columns - 1;
          if (startColumn > endColumn || startColumn < 0 || startColumn >= this.columns || endColumn < 0 || endColumn >= this.columns) {
            throw new RangeError("Argument out of range");
          }
          let newMatrix = new Matrix3(indices.length, endColumn - startColumn + 1);
          for (let i = 0; i < indices.length; i++) {
            for (let j = startColumn; j <= endColumn; j++) {
              if (indices[i] < 0 || indices[i] >= this.rows) {
                throw new RangeError(`Row index out of range: ${indices[i]}`);
              }
              newMatrix.set(i, j - startColumn, this.get(indices[i], j));
            }
          }
          return newMatrix;
        }
        subMatrixColumn(indices, startRow, endRow) {
          if (startRow === void 0) startRow = 0;
          if (endRow === void 0) endRow = this.rows - 1;
          if (startRow > endRow || startRow < 0 || startRow >= this.rows || endRow < 0 || endRow >= this.rows) {
            throw new RangeError("Argument out of range");
          }
          let newMatrix = new Matrix3(endRow - startRow + 1, indices.length);
          for (let i = 0; i < indices.length; i++) {
            for (let j = startRow; j <= endRow; j++) {
              if (indices[i] < 0 || indices[i] >= this.columns) {
                throw new RangeError(`Column index out of range: ${indices[i]}`);
              }
              newMatrix.set(j - startRow, i, this.get(j, indices[i]));
            }
          }
          return newMatrix;
        }
        setSubMatrix(matrix2, startRow, startColumn) {
          matrix2 = Matrix3.checkMatrix(matrix2);
          if (matrix2.isEmpty()) {
            return this;
          }
          let endRow = startRow + matrix2.rows - 1;
          let endColumn = startColumn + matrix2.columns - 1;
          checkRange(this, startRow, endRow, startColumn, endColumn);
          for (let i = 0; i < matrix2.rows; i++) {
            for (let j = 0; j < matrix2.columns; j++) {
              this.set(startRow + i, startColumn + j, matrix2.get(i, j));
            }
          }
          return this;
        }
        selection(rowIndices, columnIndices) {
          checkRowIndices(this, rowIndices);
          checkColumnIndices(this, columnIndices);
          let newMatrix = new Matrix3(rowIndices.length, columnIndices.length);
          for (let i = 0; i < rowIndices.length; i++) {
            let rowIndex = rowIndices[i];
            for (let j = 0; j < columnIndices.length; j++) {
              let columnIndex = columnIndices[j];
              newMatrix.set(i, j, this.get(rowIndex, columnIndex));
            }
          }
          return newMatrix;
        }
        trace() {
          let min = Math.min(this.rows, this.columns);
          let trace = 0;
          for (let i = 0; i < min; i++) {
            trace += this.get(i, i);
          }
          return trace;
        }
        clone() {
          return this.constructor.copy(this, new Matrix3(this.rows, this.columns));
        }
        /**
         * @template {AbstractMatrix} M
         * @param {AbstractMatrix} from
         * @param {M} to
         * @return {M}
         */
        static copy(from, to) {
          for (const [row, column, value] of from.entries()) {
            to.set(row, column, value);
          }
          return to;
        }
        sum(by) {
          switch (by) {
            case "row":
              return sumByRow(this);
            case "column":
              return sumByColumn(this);
            case void 0:
              return sumAll(this);
            default:
              throw new Error(`invalid option: ${by}`);
          }
        }
        product(by) {
          switch (by) {
            case "row":
              return productByRow(this);
            case "column":
              return productByColumn(this);
            case void 0:
              return productAll(this);
            default:
              throw new Error(`invalid option: ${by}`);
          }
        }
        mean(by) {
          const sum2 = this.sum(by);
          switch (by) {
            case "row": {
              for (let i = 0; i < this.rows; i++) {
                sum2[i] /= this.columns;
              }
              return sum2;
            }
            case "column": {
              for (let i = 0; i < this.columns; i++) {
                sum2[i] /= this.rows;
              }
              return sum2;
            }
            case void 0:
              return sum2 / this.size;
            default:
              throw new Error(`invalid option: ${by}`);
          }
        }
        variance(by, options = {}) {
          if (typeof by === "object") {
            options = by;
            by = void 0;
          }
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          const { unbiased = true, mean: mean3 = this.mean(by) } = options;
          if (typeof unbiased !== "boolean") {
            throw new TypeError("unbiased must be a boolean");
          }
          switch (by) {
            case "row": {
              if (!isAnyArray4.isAnyArray(mean3)) {
                throw new TypeError("mean must be an array");
              }
              return varianceByRow(this, unbiased, mean3);
            }
            case "column": {
              if (!isAnyArray4.isAnyArray(mean3)) {
                throw new TypeError("mean must be an array");
              }
              return varianceByColumn(this, unbiased, mean3);
            }
            case void 0: {
              if (typeof mean3 !== "number") {
                throw new TypeError("mean must be a number");
              }
              return varianceAll(this, unbiased, mean3);
            }
            default:
              throw new Error(`invalid option: ${by}`);
          }
        }
        standardDeviation(by, options) {
          if (typeof by === "object") {
            options = by;
            by = void 0;
          }
          const variance = this.variance(by, options);
          if (by === void 0) {
            return Math.sqrt(variance);
          } else {
            for (let i = 0; i < variance.length; i++) {
              variance[i] = Math.sqrt(variance[i]);
            }
            return variance;
          }
        }
        center(by, options = {}) {
          if (typeof by === "object") {
            options = by;
            by = void 0;
          }
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          const { center = this.mean(by) } = options;
          switch (by) {
            case "row": {
              if (!isAnyArray4.isAnyArray(center)) {
                throw new TypeError("center must be an array");
              }
              centerByRow(this, center);
              return this;
            }
            case "column": {
              if (!isAnyArray4.isAnyArray(center)) {
                throw new TypeError("center must be an array");
              }
              centerByColumn(this, center);
              return this;
            }
            case void 0: {
              if (typeof center !== "number") {
                throw new TypeError("center must be a number");
              }
              centerAll(this, center);
              return this;
            }
            default:
              throw new Error(`invalid option: ${by}`);
          }
        }
        scale(by, options = {}) {
          if (typeof by === "object") {
            options = by;
            by = void 0;
          }
          if (typeof options !== "object") {
            throw new TypeError("options must be an object");
          }
          let scale = options.scale;
          switch (by) {
            case "row": {
              if (scale === void 0) {
                scale = getScaleByRow(this);
              } else if (!isAnyArray4.isAnyArray(scale)) {
                throw new TypeError("scale must be an array");
              }
              scaleByRow(this, scale);
              return this;
            }
            case "column": {
              if (scale === void 0) {
                scale = getScaleByColumn(this);
              } else if (!isAnyArray4.isAnyArray(scale)) {
                throw new TypeError("scale must be an array");
              }
              scaleByColumn(this, scale);
              return this;
            }
            case void 0: {
              if (scale === void 0) {
                scale = getScaleAll(this);
              } else if (typeof scale !== "number") {
                throw new TypeError("scale must be a number");
              }
              scaleAll(this, scale);
              return this;
            }
            default:
              throw new Error(`invalid option: ${by}`);
          }
        }
        toString(options) {
          return inspectMatrixWithOptions(this, options);
        }
        [Symbol.iterator]() {
          return this.entries();
        }
        /**
         * iterator from left to right, from top to bottom
         * yield [row, column, value]
         * @returns {Generator<[number, number, number], void, void>}
         */
        *entries() {
          for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
              yield [row, col, this.get(row, col)];
            }
          }
        }
        /**
         * iterator from left to right, from top to bottom
         * yield value
         * @returns {Generator<number, void, void>}
         */
        *values() {
          for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
              yield this.get(row, col);
            }
          }
        }
      };
      AbstractMatrix2.prototype.klass = "Matrix";
      if (typeof Symbol !== "undefined") {
        AbstractMatrix2.prototype[Symbol.for("nodejs.util.inspect.custom")] = inspectMatrix;
      }
      function compareNumbers(a, b) {
        return a - b;
      }
      function isArrayOfNumbers(array) {
        return array.every((element) => {
          return typeof element === "number";
        });
      }
      AbstractMatrix2.random = AbstractMatrix2.rand;
      AbstractMatrix2.randomInt = AbstractMatrix2.randInt;
      AbstractMatrix2.diagonal = AbstractMatrix2.diag;
      AbstractMatrix2.prototype.diagonal = AbstractMatrix2.prototype.diag;
      AbstractMatrix2.identity = AbstractMatrix2.eye;
      AbstractMatrix2.prototype.negate = AbstractMatrix2.prototype.neg;
      AbstractMatrix2.prototype.tensorProduct = AbstractMatrix2.prototype.kroneckerProduct;
      var Matrix3 = class _Matrix extends AbstractMatrix2 {
        /**
         * @type {Float64Array[]}
         */
        data;
        /**
         * Init an empty matrix
         * @param {number} nRows
         * @param {number} nColumns
         */
        #initData(nRows, nColumns) {
          this.data = [];
          if (Number.isInteger(nColumns) && nColumns >= 0) {
            for (let i = 0; i < nRows; i++) {
              this.data.push(new Float64Array(nColumns));
            }
          } else {
            throw new TypeError("nColumns must be a positive integer");
          }
          this.rows = nRows;
          this.columns = nColumns;
        }
        constructor(nRows, nColumns) {
          super();
          if (_Matrix.isMatrix(nRows)) {
            this.#initData(nRows.rows, nRows.columns);
            _Matrix.copy(nRows, this);
          } else if (Number.isInteger(nRows) && nRows >= 0) {
            this.#initData(nRows, nColumns);
          } else if (isAnyArray4.isAnyArray(nRows)) {
            const arrayData = nRows;
            nRows = arrayData.length;
            nColumns = nRows ? arrayData[0].length : 0;
            if (typeof nColumns !== "number") {
              throw new TypeError(
                "Data must be a 2D array with at least one element"
              );
            }
            this.data = [];
            for (let i = 0; i < nRows; i++) {
              if (arrayData[i].length !== nColumns) {
                throw new RangeError("Inconsistent array dimensions");
              }
              if (!isArrayOfNumbers(arrayData[i])) {
                throw new TypeError("Input data contains non-numeric values");
              }
              this.data.push(Float64Array.from(arrayData[i]));
            }
            this.rows = nRows;
            this.columns = nColumns;
          } else {
            throw new TypeError(
              "First argument must be a positive number or an array"
            );
          }
        }
        set(rowIndex, columnIndex, value) {
          this.data[rowIndex][columnIndex] = value;
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.data[rowIndex][columnIndex];
        }
        removeRow(index) {
          checkRowIndex(this, index);
          this.data.splice(index, 1);
          this.rows -= 1;
          return this;
        }
        addRow(index, array) {
          if (array === void 0) {
            array = index;
            index = this.rows;
          }
          checkRowIndex(this, index, true);
          array = Float64Array.from(checkRowVector(this, array));
          this.data.splice(index, 0, array);
          this.rows += 1;
          return this;
        }
        removeColumn(index) {
          checkColumnIndex(this, index);
          for (let i = 0; i < this.rows; i++) {
            const newRow = new Float64Array(this.columns - 1);
            for (let j = 0; j < index; j++) {
              newRow[j] = this.data[i][j];
            }
            for (let j = index + 1; j < this.columns; j++) {
              newRow[j - 1] = this.data[i][j];
            }
            this.data[i] = newRow;
          }
          this.columns -= 1;
          return this;
        }
        addColumn(index, array) {
          if (typeof array === "undefined") {
            array = index;
            index = this.columns;
          }
          checkColumnIndex(this, index, true);
          array = checkColumnVector(this, array);
          for (let i = 0; i < this.rows; i++) {
            const newRow = new Float64Array(this.columns + 1);
            let j = 0;
            for (; j < index; j++) {
              newRow[j] = this.data[i][j];
            }
            newRow[j++] = array[i];
            for (; j < this.columns + 1; j++) {
              newRow[j] = this.data[i][j - 1];
            }
            this.data[i] = newRow;
          }
          this.columns += 1;
          return this;
        }
      };
      installMathOperations(AbstractMatrix2, Matrix3);
      var SymmetricMatrix2 = class _SymmetricMatrix extends AbstractMatrix2 {
        /** @type {Matrix} */
        #matrix;
        get size() {
          return this.#matrix.size;
        }
        get rows() {
          return this.#matrix.rows;
        }
        get columns() {
          return this.#matrix.columns;
        }
        get diagonalSize() {
          return this.rows;
        }
        /**
         * not the same as matrix.isSymmetric()
         * Here is to check if it's instanceof SymmetricMatrix without bundling issues
         *
         * @param value
         * @returns {boolean}
         */
        static isSymmetricMatrix(value) {
          return Matrix3.isMatrix(value) && value.klassType === "SymmetricMatrix";
        }
        /**
         * @param diagonalSize
         * @return {SymmetricMatrix}
         */
        static zeros(diagonalSize) {
          return new this(diagonalSize);
        }
        /**
         * @param diagonalSize
         * @return {SymmetricMatrix}
         */
        static ones(diagonalSize) {
          return new this(diagonalSize).fill(1);
        }
        /**
         * @param {number | AbstractMatrix | ArrayLike<ArrayLike<number>>} diagonalSize
         * @return {this}
         */
        constructor(diagonalSize) {
          super();
          if (Matrix3.isMatrix(diagonalSize)) {
            if (!diagonalSize.isSymmetric()) {
              throw new TypeError("not symmetric data");
            }
            this.#matrix = Matrix3.copy(
              diagonalSize,
              new Matrix3(diagonalSize.rows, diagonalSize.rows)
            );
          } else if (Number.isInteger(diagonalSize) && diagonalSize >= 0) {
            this.#matrix = new Matrix3(diagonalSize, diagonalSize);
          } else {
            this.#matrix = new Matrix3(diagonalSize);
            if (!this.isSymmetric()) {
              throw new TypeError("not symmetric data");
            }
          }
        }
        clone() {
          const matrix2 = new _SymmetricMatrix(this.diagonalSize);
          for (const [row, col, value] of this.upperRightEntries()) {
            matrix2.set(row, col, value);
          }
          return matrix2;
        }
        toMatrix() {
          return new Matrix3(this);
        }
        get(rowIndex, columnIndex) {
          return this.#matrix.get(rowIndex, columnIndex);
        }
        set(rowIndex, columnIndex, value) {
          this.#matrix.set(rowIndex, columnIndex, value);
          this.#matrix.set(columnIndex, rowIndex, value);
          return this;
        }
        removeCross(index) {
          this.#matrix.removeRow(index);
          this.#matrix.removeColumn(index);
          return this;
        }
        addCross(index, array) {
          if (array === void 0) {
            array = index;
            index = this.diagonalSize;
          }
          const row = array.slice();
          row.splice(index, 1);
          this.#matrix.addRow(index, row);
          this.#matrix.addColumn(index, array);
          return this;
        }
        /**
         * @param {Mask[]} mask
         */
        applyMask(mask) {
          if (mask.length !== this.diagonalSize) {
            throw new RangeError("Mask size do not match with matrix size");
          }
          const sidesToRemove = [];
          for (const [index, passthroughs] of mask.entries()) {
            if (passthroughs) continue;
            sidesToRemove.push(index);
          }
          sidesToRemove.reverse();
          for (const sideIndex of sidesToRemove) {
            this.removeCross(sideIndex);
          }
          return this;
        }
        /**
         * Compact format upper-right corner of matrix
         * iterate from left to right, from top to bottom.
         *
         * ```
         *   A B C D
         * A 1 2 3 4
         * B 2 5 6 7
         * C 3 6 8 9
         * D 4 7 9 10
         * ```
         *
         * will return compact 1D array `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`
         *
         * length is S(i=0, n=sideSize) => 10 for a 4 sideSized matrix
         *
         * @returns {number[]}
         */
        toCompact() {
          const { diagonalSize } = this;
          const compact = new Array(diagonalSize * (diagonalSize + 1) / 2);
          for (let col = 0, row = 0, index = 0; index < compact.length; index++) {
            compact[index] = this.get(row, col);
            if (++col >= diagonalSize) col = ++row;
          }
          return compact;
        }
        /**
         * @param {number[]} compact
         * @return {SymmetricMatrix}
         */
        static fromCompact(compact) {
          const compactSize = compact.length;
          const diagonalSize = (Math.sqrt(8 * compactSize + 1) - 1) / 2;
          if (!Number.isInteger(diagonalSize)) {
            throw new TypeError(
              `This array is not a compact representation of a Symmetric Matrix, ${JSON.stringify(
                compact
              )}`
            );
          }
          const matrix2 = new _SymmetricMatrix(diagonalSize);
          for (let col = 0, row = 0, index = 0; index < compactSize; index++) {
            matrix2.set(col, row, compact[index]);
            if (++col >= diagonalSize) col = ++row;
          }
          return matrix2;
        }
        /**
         * half iterator upper-right-corner from left to right, from top to bottom
         * yield [row, column, value]
         *
         * @returns {Generator<[number, number, number], void, void>}
         */
        *upperRightEntries() {
          for (let row = 0, col = 0; row < this.diagonalSize; void 0) {
            const value = this.get(row, col);
            yield [row, col, value];
            if (++col >= this.diagonalSize) col = ++row;
          }
        }
        /**
         * half iterator upper-right-corner from left to right, from top to bottom
         * yield value
         *
         * @returns {Generator<[number, number, number], void, void>}
         */
        *upperRightValues() {
          for (let row = 0, col = 0; row < this.diagonalSize; void 0) {
            const value = this.get(row, col);
            yield value;
            if (++col >= this.diagonalSize) col = ++row;
          }
        }
      };
      SymmetricMatrix2.prototype.klassType = "SymmetricMatrix";
      var DistanceMatrix2 = class _DistanceMatrix extends SymmetricMatrix2 {
        /**
         * not the same as matrix.isSymmetric()
         * Here is to check if it's instanceof SymmetricMatrix without bundling issues
         *
         * @param value
         * @returns {boolean}
         */
        static isDistanceMatrix(value) {
          return SymmetricMatrix2.isSymmetricMatrix(value) && value.klassSubType === "DistanceMatrix";
        }
        constructor(sideSize) {
          super(sideSize);
          if (!this.isDistance()) {
            throw new TypeError("Provided arguments do no produce a distance matrix");
          }
        }
        set(rowIndex, columnIndex, value) {
          if (rowIndex === columnIndex) value = 0;
          return super.set(rowIndex, columnIndex, value);
        }
        addCross(index, array) {
          if (array === void 0) {
            array = index;
            index = this.diagonalSize;
          }
          array = array.slice();
          array[index] = 0;
          return super.addCross(index, array);
        }
        toSymmetricMatrix() {
          return new SymmetricMatrix2(this);
        }
        clone() {
          const matrix2 = new _DistanceMatrix(this.diagonalSize);
          for (const [row, col, value] of this.upperRightEntries()) {
            if (row === col) continue;
            matrix2.set(row, col, value);
          }
          return matrix2;
        }
        /**
         * Compact format upper-right corner of matrix
         * no diagonal (only zeros)
         * iterable from left to right, from top to bottom.
         *
         * ```
         *   A B C D
         * A 0 1 2 3
         * B 1 0 4 5
         * C 2 4 0 6
         * D 3 5 6 0
         * ```
         *
         * will return compact 1D array `[1, 2, 3, 4, 5, 6]`
         *
         * length is S(i=0, n=sideSize-1) => 6 for a 4 side sized matrix
         *
         * @returns {number[]}
         */
        toCompact() {
          const { diagonalSize } = this;
          const compactLength = (diagonalSize - 1) * diagonalSize / 2;
          const compact = new Array(compactLength);
          for (let col = 1, row = 0, index = 0; index < compact.length; index++) {
            compact[index] = this.get(row, col);
            if (++col >= diagonalSize) col = ++row + 1;
          }
          return compact;
        }
        /**
         * @param {number[]} compact
         */
        static fromCompact(compact) {
          const compactSize = compact.length;
          if (compactSize === 0) {
            return new this(0);
          }
          const diagonalSize = (Math.sqrt(8 * compactSize + 1) + 1) / 2;
          if (!Number.isInteger(diagonalSize)) {
            throw new TypeError(
              `This array is not a compact representation of a DistanceMatrix, ${JSON.stringify(
                compact
              )}`
            );
          }
          const matrix2 = new this(diagonalSize);
          for (let col = 1, row = 0, index = 0; index < compactSize; index++) {
            matrix2.set(col, row, compact[index]);
            if (++col >= diagonalSize) col = ++row + 1;
          }
          return matrix2;
        }
      };
      DistanceMatrix2.prototype.klassSubType = "DistanceMatrix";
      var BaseView = class extends AbstractMatrix2 {
        constructor(matrix2, rows, columns) {
          super();
          this.matrix = matrix2;
          this.rows = rows;
          this.columns = columns;
        }
      };
      var MatrixColumnView2 = class extends BaseView {
        constructor(matrix2, column) {
          checkColumnIndex(matrix2, column);
          super(matrix2, matrix2.rows, 1);
          this.column = column;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(rowIndex, this.column, value);
          return this;
        }
        get(rowIndex) {
          return this.matrix.get(rowIndex, this.column);
        }
      };
      var MatrixColumnSelectionView3 = class extends BaseView {
        constructor(matrix2, columnIndices) {
          checkColumnIndices(matrix2, columnIndices);
          super(matrix2, matrix2.rows, columnIndices.length);
          this.columnIndices = columnIndices;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(rowIndex, this.columnIndices[columnIndex], value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(rowIndex, this.columnIndices[columnIndex]);
        }
      };
      var MatrixFlipColumnView2 = class extends BaseView {
        constructor(matrix2) {
          super(matrix2, matrix2.rows, matrix2.columns);
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(rowIndex, this.columns - columnIndex - 1, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(rowIndex, this.columns - columnIndex - 1);
        }
      };
      var MatrixFlipRowView2 = class extends BaseView {
        constructor(matrix2) {
          super(matrix2, matrix2.rows, matrix2.columns);
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(this.rows - rowIndex - 1, columnIndex, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(this.rows - rowIndex - 1, columnIndex);
        }
      };
      var MatrixRowView2 = class extends BaseView {
        constructor(matrix2, row) {
          checkRowIndex(matrix2, row);
          super(matrix2, 1, matrix2.columns);
          this.row = row;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(this.row, columnIndex, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(this.row, columnIndex);
        }
      };
      var MatrixRowSelectionView2 = class extends BaseView {
        constructor(matrix2, rowIndices) {
          checkRowIndices(matrix2, rowIndices);
          super(matrix2, rowIndices.length, matrix2.columns);
          this.rowIndices = rowIndices;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(this.rowIndices[rowIndex], columnIndex, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(this.rowIndices[rowIndex], columnIndex);
        }
      };
      var MatrixSelectionView2 = class extends BaseView {
        constructor(matrix2, rowIndices, columnIndices) {
          checkRowIndices(matrix2, rowIndices);
          checkColumnIndices(matrix2, columnIndices);
          super(matrix2, rowIndices.length, columnIndices.length);
          this.rowIndices = rowIndices;
          this.columnIndices = columnIndices;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(
            this.rowIndices[rowIndex],
            this.columnIndices[columnIndex],
            value
          );
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(
            this.rowIndices[rowIndex],
            this.columnIndices[columnIndex]
          );
        }
      };
      var MatrixSubView2 = class extends BaseView {
        constructor(matrix2, startRow, endRow, startColumn, endColumn) {
          checkRange(matrix2, startRow, endRow, startColumn, endColumn);
          super(matrix2, endRow - startRow + 1, endColumn - startColumn + 1);
          this.startRow = startRow;
          this.startColumn = startColumn;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(
            this.startRow + rowIndex,
            this.startColumn + columnIndex,
            value
          );
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(
            this.startRow + rowIndex,
            this.startColumn + columnIndex
          );
        }
      };
      var MatrixTransposeView3 = class extends BaseView {
        constructor(matrix2) {
          super(matrix2, matrix2.columns, matrix2.rows);
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(columnIndex, rowIndex, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(columnIndex, rowIndex);
        }
      };
      var WrapperMatrix1D2 = class extends AbstractMatrix2 {
        constructor(data, options = {}) {
          const { rows = 1 } = options;
          if (data.length % rows !== 0) {
            throw new Error("the data length is not divisible by the number of rows");
          }
          super();
          this.rows = rows;
          this.columns = data.length / rows;
          this.data = data;
        }
        set(rowIndex, columnIndex, value) {
          let index = this._calculateIndex(rowIndex, columnIndex);
          this.data[index] = value;
          return this;
        }
        get(rowIndex, columnIndex) {
          let index = this._calculateIndex(rowIndex, columnIndex);
          return this.data[index];
        }
        _calculateIndex(row, column) {
          return row * this.columns + column;
        }
      };
      var WrapperMatrix2D3 = class extends AbstractMatrix2 {
        constructor(data) {
          super();
          this.data = data;
          this.rows = data.length;
          this.columns = data[0].length;
        }
        set(rowIndex, columnIndex, value) {
          this.data[rowIndex][columnIndex] = value;
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.data[rowIndex][columnIndex];
        }
      };
      function wrap2(array, options) {
        if (isAnyArray4.isAnyArray(array)) {
          if (array[0] && isAnyArray4.isAnyArray(array[0])) {
            return new WrapperMatrix2D3(array);
          } else {
            return new WrapperMatrix1D2(array, options);
          }
        } else {
          throw new Error("the argument is not an array");
        }
      }
      var LuDecomposition2 = class {
        constructor(matrix2) {
          matrix2 = WrapperMatrix2D3.checkMatrix(matrix2);
          let lu = matrix2.clone();
          let rows = lu.rows;
          let columns = lu.columns;
          let pivotVector = new Float64Array(rows);
          let pivotSign = 1;
          let i, j, k, p, s, t, v;
          let LUcolj, kmax;
          for (i = 0; i < rows; i++) {
            pivotVector[i] = i;
          }
          LUcolj = new Float64Array(rows);
          for (j = 0; j < columns; j++) {
            for (i = 0; i < rows; i++) {
              LUcolj[i] = lu.get(i, j);
            }
            for (i = 0; i < rows; i++) {
              kmax = Math.min(i, j);
              s = 0;
              for (k = 0; k < kmax; k++) {
                s += lu.get(i, k) * LUcolj[k];
              }
              LUcolj[i] -= s;
              lu.set(i, j, LUcolj[i]);
            }
            p = j;
            for (i = j + 1; i < rows; i++) {
              if (Math.abs(LUcolj[i]) > Math.abs(LUcolj[p])) {
                p = i;
              }
            }
            if (p !== j) {
              for (k = 0; k < columns; k++) {
                t = lu.get(p, k);
                lu.set(p, k, lu.get(j, k));
                lu.set(j, k, t);
              }
              v = pivotVector[p];
              pivotVector[p] = pivotVector[j];
              pivotVector[j] = v;
              pivotSign = -pivotSign;
            }
            if (j < rows && lu.get(j, j) !== 0) {
              for (i = j + 1; i < rows; i++) {
                lu.set(i, j, lu.get(i, j) / lu.get(j, j));
              }
            }
          }
          this.LU = lu;
          this.pivotVector = pivotVector;
          this.pivotSign = pivotSign;
        }
        isSingular() {
          let data = this.LU;
          let col = data.columns;
          for (let j = 0; j < col; j++) {
            if (data.get(j, j) === 0) {
              return true;
            }
          }
          return false;
        }
        solve(value) {
          value = Matrix3.checkMatrix(value);
          let lu = this.LU;
          let rows = lu.rows;
          if (rows !== value.rows) {
            throw new Error("Invalid matrix dimensions");
          }
          if (this.isSingular()) {
            throw new Error("LU matrix is singular");
          }
          let count = value.columns;
          let X = value.subMatrixRow(this.pivotVector, 0, count - 1);
          let columns = lu.columns;
          let i, j, k;
          for (k = 0; k < columns; k++) {
            for (i = k + 1; i < columns; i++) {
              for (j = 0; j < count; j++) {
                X.set(i, j, X.get(i, j) - X.get(k, j) * lu.get(i, k));
              }
            }
          }
          for (k = columns - 1; k >= 0; k--) {
            for (j = 0; j < count; j++) {
              X.set(k, j, X.get(k, j) / lu.get(k, k));
            }
            for (i = 0; i < k; i++) {
              for (j = 0; j < count; j++) {
                X.set(i, j, X.get(i, j) - X.get(k, j) * lu.get(i, k));
              }
            }
          }
          return X;
        }
        get determinant() {
          let data = this.LU;
          if (!data.isSquare()) {
            throw new Error("Matrix must be square");
          }
          let determinant3 = this.pivotSign;
          let col = data.columns;
          for (let j = 0; j < col; j++) {
            determinant3 *= data.get(j, j);
          }
          return determinant3;
        }
        get lowerTriangularMatrix() {
          let data = this.LU;
          let rows = data.rows;
          let columns = data.columns;
          let X = new Matrix3(rows, columns);
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              if (i > j) {
                X.set(i, j, data.get(i, j));
              } else if (i === j) {
                X.set(i, j, 1);
              } else {
                X.set(i, j, 0);
              }
            }
          }
          return X;
        }
        get upperTriangularMatrix() {
          let data = this.LU;
          let rows = data.rows;
          let columns = data.columns;
          let X = new Matrix3(rows, columns);
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              if (i <= j) {
                X.set(i, j, data.get(i, j));
              } else {
                X.set(i, j, 0);
              }
            }
          }
          return X;
        }
        get pivotPermutationVector() {
          return Array.from(this.pivotVector);
        }
      };
      function hypotenuse(a, b) {
        let r = 0;
        if (Math.abs(a) > Math.abs(b)) {
          r = b / a;
          return Math.abs(a) * Math.sqrt(1 + r * r);
        }
        if (b !== 0) {
          r = a / b;
          return Math.abs(b) * Math.sqrt(1 + r * r);
        }
        return 0;
      }
      var QrDecomposition2 = class {
        constructor(value) {
          value = WrapperMatrix2D3.checkMatrix(value);
          let qr = value.clone();
          let m = value.rows;
          let n = value.columns;
          let rdiag = new Float64Array(n);
          let i, j, k, s;
          for (k = 0; k < n; k++) {
            let nrm = 0;
            for (i = k; i < m; i++) {
              nrm = hypotenuse(nrm, qr.get(i, k));
            }
            if (nrm !== 0) {
              if (qr.get(k, k) < 0) {
                nrm = -nrm;
              }
              for (i = k; i < m; i++) {
                qr.set(i, k, qr.get(i, k) / nrm);
              }
              qr.set(k, k, qr.get(k, k) + 1);
              for (j = k + 1; j < n; j++) {
                s = 0;
                for (i = k; i < m; i++) {
                  s += qr.get(i, k) * qr.get(i, j);
                }
                s = -s / qr.get(k, k);
                for (i = k; i < m; i++) {
                  qr.set(i, j, qr.get(i, j) + s * qr.get(i, k));
                }
              }
            }
            rdiag[k] = -nrm;
          }
          this.QR = qr;
          this.Rdiag = rdiag;
        }
        solve(value) {
          value = Matrix3.checkMatrix(value);
          let qr = this.QR;
          let m = qr.rows;
          if (value.rows !== m) {
            throw new Error("Matrix row dimensions must agree");
          }
          if (!this.isFullRank()) {
            throw new Error("Matrix is rank deficient");
          }
          let count = value.columns;
          let X = value.clone();
          let n = qr.columns;
          let i, j, k, s;
          for (k = 0; k < n; k++) {
            for (j = 0; j < count; j++) {
              s = 0;
              for (i = k; i < m; i++) {
                s += qr.get(i, k) * X.get(i, j);
              }
              s = -s / qr.get(k, k);
              for (i = k; i < m; i++) {
                X.set(i, j, X.get(i, j) + s * qr.get(i, k));
              }
            }
          }
          for (k = n - 1; k >= 0; k--) {
            for (j = 0; j < count; j++) {
              X.set(k, j, X.get(k, j) / this.Rdiag[k]);
            }
            for (i = 0; i < k; i++) {
              for (j = 0; j < count; j++) {
                X.set(i, j, X.get(i, j) - X.get(k, j) * qr.get(i, k));
              }
            }
          }
          return X.subMatrix(0, n - 1, 0, count - 1);
        }
        isFullRank() {
          let columns = this.QR.columns;
          for (let i = 0; i < columns; i++) {
            if (this.Rdiag[i] === 0) {
              return false;
            }
          }
          return true;
        }
        get upperTriangularMatrix() {
          let qr = this.QR;
          let n = qr.columns;
          let X = new Matrix3(n, n);
          let i, j;
          for (i = 0; i < n; i++) {
            for (j = 0; j < n; j++) {
              if (i < j) {
                X.set(i, j, qr.get(i, j));
              } else if (i === j) {
                X.set(i, j, this.Rdiag[i]);
              } else {
                X.set(i, j, 0);
              }
            }
          }
          return X;
        }
        get orthogonalMatrix() {
          let qr = this.QR;
          let rows = qr.rows;
          let columns = qr.columns;
          let X = new Matrix3(rows, columns);
          let i, j, k, s;
          for (k = columns - 1; k >= 0; k--) {
            for (i = 0; i < rows; i++) {
              X.set(i, k, 0);
            }
            X.set(k, k, 1);
            for (j = k; j < columns; j++) {
              if (qr.get(k, k) !== 0) {
                s = 0;
                for (i = k; i < rows; i++) {
                  s += qr.get(i, k) * X.get(i, j);
                }
                s = -s / qr.get(k, k);
                for (i = k; i < rows; i++) {
                  X.set(i, j, X.get(i, j) + s * qr.get(i, k));
                }
              }
            }
          }
          return X;
        }
      };
      var SingularValueDecomposition2 = class {
        constructor(value, options = {}) {
          value = WrapperMatrix2D3.checkMatrix(value);
          if (value.isEmpty()) {
            throw new Error("Matrix must be non-empty");
          }
          let m = value.rows;
          let n = value.columns;
          const {
            computeLeftSingularVectors = true,
            computeRightSingularVectors = true,
            autoTranspose = false
          } = options;
          let wantu = Boolean(computeLeftSingularVectors);
          let wantv = Boolean(computeRightSingularVectors);
          let swapped = false;
          let a;
          if (m < n) {
            if (!autoTranspose) {
              a = value.clone();
              console.warn(
                "Computing SVD on a matrix with more columns than rows. Consider enabling autoTranspose"
              );
            } else {
              a = value.transpose();
              m = a.rows;
              n = a.columns;
              swapped = true;
              let aux = wantu;
              wantu = wantv;
              wantv = aux;
            }
          } else {
            a = value.clone();
          }
          let nu = Math.min(m, n);
          let ni = Math.min(m + 1, n);
          let s = new Float64Array(ni);
          let U = new Matrix3(m, nu);
          let V = new Matrix3(n, n);
          let e = new Float64Array(n);
          let work = new Float64Array(m);
          let si = new Float64Array(ni);
          for (let i = 0; i < ni; i++) si[i] = i;
          let nct = Math.min(m - 1, n);
          let nrt = Math.max(0, Math.min(n - 2, m));
          let mrc = Math.max(nct, nrt);
          for (let k = 0; k < mrc; k++) {
            if (k < nct) {
              s[k] = 0;
              for (let i = k; i < m; i++) {
                s[k] = hypotenuse(s[k], a.get(i, k));
              }
              if (s[k] !== 0) {
                if (a.get(k, k) < 0) {
                  s[k] = -s[k];
                }
                for (let i = k; i < m; i++) {
                  a.set(i, k, a.get(i, k) / s[k]);
                }
                a.set(k, k, a.get(k, k) + 1);
              }
              s[k] = -s[k];
            }
            for (let j = k + 1; j < n; j++) {
              if (k < nct && s[k] !== 0) {
                let t = 0;
                for (let i = k; i < m; i++) {
                  t += a.get(i, k) * a.get(i, j);
                }
                t = -t / a.get(k, k);
                for (let i = k; i < m; i++) {
                  a.set(i, j, a.get(i, j) + t * a.get(i, k));
                }
              }
              e[j] = a.get(k, j);
            }
            if (wantu && k < nct) {
              for (let i = k; i < m; i++) {
                U.set(i, k, a.get(i, k));
              }
            }
            if (k < nrt) {
              e[k] = 0;
              for (let i = k + 1; i < n; i++) {
                e[k] = hypotenuse(e[k], e[i]);
              }
              if (e[k] !== 0) {
                if (e[k + 1] < 0) {
                  e[k] = 0 - e[k];
                }
                for (let i = k + 1; i < n; i++) {
                  e[i] /= e[k];
                }
                e[k + 1] += 1;
              }
              e[k] = -e[k];
              if (k + 1 < m && e[k] !== 0) {
                for (let i = k + 1; i < m; i++) {
                  work[i] = 0;
                }
                for (let i = k + 1; i < m; i++) {
                  for (let j = k + 1; j < n; j++) {
                    work[i] += e[j] * a.get(i, j);
                  }
                }
                for (let j = k + 1; j < n; j++) {
                  let t = -e[j] / e[k + 1];
                  for (let i = k + 1; i < m; i++) {
                    a.set(i, j, a.get(i, j) + t * work[i]);
                  }
                }
              }
              if (wantv) {
                for (let i = k + 1; i < n; i++) {
                  V.set(i, k, e[i]);
                }
              }
            }
          }
          let p = Math.min(n, m + 1);
          if (nct < n) {
            s[nct] = a.get(nct, nct);
          }
          if (m < p) {
            s[p - 1] = 0;
          }
          if (nrt + 1 < p) {
            e[nrt] = a.get(nrt, p - 1);
          }
          e[p - 1] = 0;
          if (wantu) {
            for (let j = nct; j < nu; j++) {
              for (let i = 0; i < m; i++) {
                U.set(i, j, 0);
              }
              U.set(j, j, 1);
            }
            for (let k = nct - 1; k >= 0; k--) {
              if (s[k] !== 0) {
                for (let j = k + 1; j < nu; j++) {
                  let t = 0;
                  for (let i = k; i < m; i++) {
                    t += U.get(i, k) * U.get(i, j);
                  }
                  t = -t / U.get(k, k);
                  for (let i = k; i < m; i++) {
                    U.set(i, j, U.get(i, j) + t * U.get(i, k));
                  }
                }
                for (let i = k; i < m; i++) {
                  U.set(i, k, -U.get(i, k));
                }
                U.set(k, k, 1 + U.get(k, k));
                for (let i = 0; i < k - 1; i++) {
                  U.set(i, k, 0);
                }
              } else {
                for (let i = 0; i < m; i++) {
                  U.set(i, k, 0);
                }
                U.set(k, k, 1);
              }
            }
          }
          if (wantv) {
            for (let k = n - 1; k >= 0; k--) {
              if (k < nrt && e[k] !== 0) {
                for (let j = k + 1; j < n; j++) {
                  let t = 0;
                  for (let i = k + 1; i < n; i++) {
                    t += V.get(i, k) * V.get(i, j);
                  }
                  t = -t / V.get(k + 1, k);
                  for (let i = k + 1; i < n; i++) {
                    V.set(i, j, V.get(i, j) + t * V.get(i, k));
                  }
                }
              }
              for (let i = 0; i < n; i++) {
                V.set(i, k, 0);
              }
              V.set(k, k, 1);
            }
          }
          let pp = p - 1;
          let eps = Number.EPSILON;
          while (p > 0) {
            let k, kase;
            for (k = p - 2; k >= -1; k--) {
              if (k === -1) {
                break;
              }
              const alpha = Number.MIN_VALUE + eps * Math.abs(s[k] + Math.abs(s[k + 1]));
              if (Math.abs(e[k]) <= alpha || Number.isNaN(e[k])) {
                e[k] = 0;
                break;
              }
            }
            if (k === p - 2) {
              kase = 4;
            } else {
              let ks;
              for (ks = p - 1; ks >= k; ks--) {
                if (ks === k) {
                  break;
                }
                let t = (ks !== p ? Math.abs(e[ks]) : 0) + (ks !== k + 1 ? Math.abs(e[ks - 1]) : 0);
                if (Math.abs(s[ks]) <= eps * t) {
                  s[ks] = 0;
                  break;
                }
              }
              if (ks === k) {
                kase = 3;
              } else if (ks === p - 1) {
                kase = 1;
              } else {
                kase = 2;
                k = ks;
              }
            }
            k++;
            switch (kase) {
              case 1: {
                let f = e[p - 2];
                e[p - 2] = 0;
                for (let j = p - 2; j >= k; j--) {
                  let t = hypotenuse(s[j], f);
                  let cs = s[j] / t;
                  let sn = f / t;
                  s[j] = t;
                  if (j !== k) {
                    f = -sn * e[j - 1];
                    e[j - 1] = cs * e[j - 1];
                  }
                  if (wantv) {
                    for (let i = 0; i < n; i++) {
                      t = cs * V.get(i, j) + sn * V.get(i, p - 1);
                      V.set(i, p - 1, -sn * V.get(i, j) + cs * V.get(i, p - 1));
                      V.set(i, j, t);
                    }
                  }
                }
                break;
              }
              case 2: {
                let f = e[k - 1];
                e[k - 1] = 0;
                for (let j = k; j < p; j++) {
                  let t = hypotenuse(s[j], f);
                  let cs = s[j] / t;
                  let sn = f / t;
                  s[j] = t;
                  f = -sn * e[j];
                  e[j] = cs * e[j];
                  if (wantu) {
                    for (let i = 0; i < m; i++) {
                      t = cs * U.get(i, j) + sn * U.get(i, k - 1);
                      U.set(i, k - 1, -sn * U.get(i, j) + cs * U.get(i, k - 1));
                      U.set(i, j, t);
                    }
                  }
                }
                break;
              }
              case 3: {
                const scale = Math.max(
                  Math.abs(s[p - 1]),
                  Math.abs(s[p - 2]),
                  Math.abs(e[p - 2]),
                  Math.abs(s[k]),
                  Math.abs(e[k])
                );
                const sp = s[p - 1] / scale;
                const spm1 = s[p - 2] / scale;
                const epm1 = e[p - 2] / scale;
                const sk = s[k] / scale;
                const ek = e[k] / scale;
                const b = ((spm1 + sp) * (spm1 - sp) + epm1 * epm1) / 2;
                const c = sp * epm1 * (sp * epm1);
                let shift = 0;
                if (b !== 0 || c !== 0) {
                  if (b < 0) {
                    shift = 0 - Math.sqrt(b * b + c);
                  } else {
                    shift = Math.sqrt(b * b + c);
                  }
                  shift = c / (b + shift);
                }
                let f = (sk + sp) * (sk - sp) + shift;
                let g = sk * ek;
                for (let j = k; j < p - 1; j++) {
                  let t = hypotenuse(f, g);
                  if (t === 0) t = Number.MIN_VALUE;
                  let cs = f / t;
                  let sn = g / t;
                  if (j !== k) {
                    e[j - 1] = t;
                  }
                  f = cs * s[j] + sn * e[j];
                  e[j] = cs * e[j] - sn * s[j];
                  g = sn * s[j + 1];
                  s[j + 1] = cs * s[j + 1];
                  if (wantv) {
                    for (let i = 0; i < n; i++) {
                      t = cs * V.get(i, j) + sn * V.get(i, j + 1);
                      V.set(i, j + 1, -sn * V.get(i, j) + cs * V.get(i, j + 1));
                      V.set(i, j, t);
                    }
                  }
                  t = hypotenuse(f, g);
                  if (t === 0) t = Number.MIN_VALUE;
                  cs = f / t;
                  sn = g / t;
                  s[j] = t;
                  f = cs * e[j] + sn * s[j + 1];
                  s[j + 1] = -sn * e[j] + cs * s[j + 1];
                  g = sn * e[j + 1];
                  e[j + 1] = cs * e[j + 1];
                  if (wantu && j < m - 1) {
                    for (let i = 0; i < m; i++) {
                      t = cs * U.get(i, j) + sn * U.get(i, j + 1);
                      U.set(i, j + 1, -sn * U.get(i, j) + cs * U.get(i, j + 1));
                      U.set(i, j, t);
                    }
                  }
                }
                e[p - 2] = f;
                break;
              }
              case 4: {
                if (s[k] <= 0) {
                  s[k] = s[k] < 0 ? -s[k] : 0;
                  if (wantv) {
                    for (let i = 0; i <= pp; i++) {
                      V.set(i, k, -V.get(i, k));
                    }
                  }
                }
                while (k < pp) {
                  if (s[k] >= s[k + 1]) {
                    break;
                  }
                  let t = s[k];
                  s[k] = s[k + 1];
                  s[k + 1] = t;
                  if (wantv && k < n - 1) {
                    for (let i = 0; i < n; i++) {
                      t = V.get(i, k + 1);
                      V.set(i, k + 1, V.get(i, k));
                      V.set(i, k, t);
                    }
                  }
                  if (wantu && k < m - 1) {
                    for (let i = 0; i < m; i++) {
                      t = U.get(i, k + 1);
                      U.set(i, k + 1, U.get(i, k));
                      U.set(i, k, t);
                    }
                  }
                  k++;
                }
                p--;
                break;
              }
            }
          }
          if (swapped) {
            let tmp = V;
            V = U;
            U = tmp;
          }
          this.m = m;
          this.n = n;
          this.s = s;
          this.U = U;
          this.V = V;
        }
        solve(value) {
          let Y = value;
          let e = this.threshold;
          let scols = this.s.length;
          let Ls = Matrix3.zeros(scols, scols);
          for (let i = 0; i < scols; i++) {
            if (Math.abs(this.s[i]) <= e) {
              Ls.set(i, i, 0);
            } else {
              Ls.set(i, i, 1 / this.s[i]);
            }
          }
          let U = this.U;
          let V = this.rightSingularVectors;
          let VL = V.mmul(Ls);
          let vrows = V.rows;
          let urows = U.rows;
          let VLU = Matrix3.zeros(vrows, urows);
          for (let i = 0; i < vrows; i++) {
            for (let j = 0; j < urows; j++) {
              let sum2 = 0;
              for (let k = 0; k < scols; k++) {
                sum2 += VL.get(i, k) * U.get(j, k);
              }
              VLU.set(i, j, sum2);
            }
          }
          return VLU.mmul(Y);
        }
        solveForDiagonal(value) {
          return this.solve(Matrix3.diag(value));
        }
        inverse() {
          let V = this.V;
          let e = this.threshold;
          let vrows = V.rows;
          let vcols = V.columns;
          let X = new Matrix3(vrows, this.s.length);
          for (let i = 0; i < vrows; i++) {
            for (let j = 0; j < vcols; j++) {
              if (Math.abs(this.s[j]) > e) {
                X.set(i, j, V.get(i, j) / this.s[j]);
              }
            }
          }
          let U = this.U;
          let urows = U.rows;
          let ucols = U.columns;
          let Y = new Matrix3(vrows, urows);
          for (let i = 0; i < vrows; i++) {
            for (let j = 0; j < urows; j++) {
              let sum2 = 0;
              for (let k = 0; k < ucols; k++) {
                sum2 += X.get(i, k) * U.get(j, k);
              }
              Y.set(i, j, sum2);
            }
          }
          return Y;
        }
        get condition() {
          return this.s[0] / this.s[Math.min(this.m, this.n) - 1];
        }
        get norm2() {
          return this.s[0];
        }
        get rank() {
          let tol = Math.max(this.m, this.n) * this.s[0] * Number.EPSILON;
          let r = 0;
          let s = this.s;
          for (let i = 0, ii = s.length; i < ii; i++) {
            if (s[i] > tol) {
              r++;
            }
          }
          return r;
        }
        get diagonal() {
          return Array.from(this.s);
        }
        get threshold() {
          return Number.EPSILON / 2 * Math.max(this.m, this.n) * this.s[0];
        }
        get leftSingularVectors() {
          return this.U;
        }
        get rightSingularVectors() {
          return this.V;
        }
        get diagonalMatrix() {
          return Matrix3.diag(this.s);
        }
      };
      function inverse2(matrix2, useSVD = false) {
        matrix2 = WrapperMatrix2D3.checkMatrix(matrix2);
        if (useSVD) {
          return new SingularValueDecomposition2(matrix2).inverse();
        } else {
          return solve2(matrix2, Matrix3.eye(matrix2.rows));
        }
      }
      function solve2(leftHandSide, rightHandSide, useSVD = false) {
        leftHandSide = WrapperMatrix2D3.checkMatrix(leftHandSide);
        rightHandSide = WrapperMatrix2D3.checkMatrix(rightHandSide);
        if (useSVD) {
          return new SingularValueDecomposition2(leftHandSide).solve(rightHandSide);
        } else {
          return leftHandSide.isSquare() ? new LuDecomposition2(leftHandSide).solve(rightHandSide) : new QrDecomposition2(leftHandSide).solve(rightHandSide);
        }
      }
      function determinant2(matrix2) {
        matrix2 = Matrix3.checkMatrix(matrix2);
        if (matrix2.isSquare()) {
          if (matrix2.columns === 0) {
            return 1;
          }
          let a, b, c, d;
          if (matrix2.columns === 2) {
            a = matrix2.get(0, 0);
            b = matrix2.get(0, 1);
            c = matrix2.get(1, 0);
            d = matrix2.get(1, 1);
            return a * d - b * c;
          } else if (matrix2.columns === 3) {
            let subMatrix0, subMatrix1, subMatrix2;
            subMatrix0 = new MatrixSelectionView2(matrix2, [1, 2], [1, 2]);
            subMatrix1 = new MatrixSelectionView2(matrix2, [1, 2], [0, 2]);
            subMatrix2 = new MatrixSelectionView2(matrix2, [1, 2], [0, 1]);
            a = matrix2.get(0, 0);
            b = matrix2.get(0, 1);
            c = matrix2.get(0, 2);
            return a * determinant2(subMatrix0) - b * determinant2(subMatrix1) + c * determinant2(subMatrix2);
          } else {
            return new LuDecomposition2(matrix2).determinant;
          }
        } else {
          throw Error("determinant can only be calculated for a square matrix");
        }
      }
      function xrange(n, exception) {
        let range = [];
        for (let i = 0; i < n; i++) {
          if (i !== exception) {
            range.push(i);
          }
        }
        return range;
      }
      function dependenciesOneRow(error, matrix2, index, thresholdValue = 1e-9, thresholdError = 1e-9) {
        if (error > thresholdError) {
          return new Array(matrix2.rows + 1).fill(0);
        } else {
          let returnArray = matrix2.addRow(index, [0]);
          for (let i = 0; i < returnArray.rows; i++) {
            if (Math.abs(returnArray.get(i, 0)) < thresholdValue) {
              returnArray.set(i, 0, 0);
            }
          }
          return returnArray.to1DArray();
        }
      }
      function linearDependencies2(matrix2, options = {}) {
        const { thresholdValue = 1e-9, thresholdError = 1e-9 } = options;
        matrix2 = Matrix3.checkMatrix(matrix2);
        let n = matrix2.rows;
        let results = new Matrix3(n, n);
        for (let i = 0; i < n; i++) {
          let b = Matrix3.columnVector(matrix2.getRow(i));
          let Abis = matrix2.subMatrixRow(xrange(n, i)).transpose();
          let svd = new SingularValueDecomposition2(Abis);
          let x = svd.solve(b);
          let error = Matrix3.sub(b, Abis.mmul(x)).abs().max();
          results.setRow(
            i,
            dependenciesOneRow(error, x, i, thresholdValue, thresholdError)
          );
        }
        return results;
      }
      function pseudoInverse2(matrix2, threshold = Number.EPSILON) {
        matrix2 = Matrix3.checkMatrix(matrix2);
        if (matrix2.isEmpty()) {
          return matrix2.transpose();
        }
        let svdSolution = new SingularValueDecomposition2(matrix2, { autoTranspose: true });
        let U = svdSolution.leftSingularVectors;
        let V = svdSolution.rightSingularVectors;
        let s = svdSolution.diagonal;
        for (let i = 0; i < s.length; i++) {
          if (Math.abs(s[i]) > threshold) {
            s[i] = 1 / s[i];
          } else {
            s[i] = 0;
          }
        }
        return V.mmul(Matrix3.diag(s).mmul(U.transpose()));
      }
      function covariance2(xMatrix, yMatrix = xMatrix, options = {}) {
        xMatrix = new Matrix3(xMatrix);
        let yIsSame = false;
        if (typeof yMatrix === "object" && !Matrix3.isMatrix(yMatrix) && !isAnyArray4.isAnyArray(yMatrix)) {
          options = yMatrix;
          yMatrix = xMatrix;
          yIsSame = true;
        } else {
          yMatrix = new Matrix3(yMatrix);
        }
        if (xMatrix.rows !== yMatrix.rows) {
          throw new TypeError("Both matrices must have the same number of rows");
        }
        const { center = true } = options;
        if (center) {
          xMatrix = xMatrix.center("column");
          if (!yIsSame) {
            yMatrix = yMatrix.center("column");
          }
        }
        const cov = xMatrix.transpose().mmul(yMatrix);
        for (let i = 0; i < cov.rows; i++) {
          for (let j = 0; j < cov.columns; j++) {
            cov.set(i, j, cov.get(i, j) * (1 / (xMatrix.rows - 1)));
          }
        }
        return cov;
      }
      function correlation2(xMatrix, yMatrix = xMatrix, options = {}) {
        xMatrix = new Matrix3(xMatrix);
        let yIsSame = false;
        if (typeof yMatrix === "object" && !Matrix3.isMatrix(yMatrix) && !isAnyArray4.isAnyArray(yMatrix)) {
          options = yMatrix;
          yMatrix = xMatrix;
          yIsSame = true;
        } else {
          yMatrix = new Matrix3(yMatrix);
        }
        if (xMatrix.rows !== yMatrix.rows) {
          throw new TypeError("Both matrices must have the same number of rows");
        }
        const { center = true, scale = true } = options;
        if (center) {
          xMatrix.center("column");
          if (!yIsSame) {
            yMatrix.center("column");
          }
        }
        if (scale) {
          xMatrix.scale("column");
          if (!yIsSame) {
            yMatrix.scale("column");
          }
        }
        const sdx = xMatrix.standardDeviation("column", { unbiased: true });
        const sdy = yIsSame ? sdx : yMatrix.standardDeviation("column", { unbiased: true });
        const corr = xMatrix.transpose().mmul(yMatrix);
        for (let i = 0; i < corr.rows; i++) {
          for (let j = 0; j < corr.columns; j++) {
            corr.set(
              i,
              j,
              corr.get(i, j) * (1 / (sdx[i] * sdy[j])) * (1 / (xMatrix.rows - 1))
            );
          }
        }
        return corr;
      }
      var EigenvalueDecomposition2 = class {
        constructor(matrix2, options = {}) {
          const { assumeSymmetric = false } = options;
          matrix2 = WrapperMatrix2D3.checkMatrix(matrix2);
          if (!matrix2.isSquare()) {
            throw new Error("Matrix is not a square matrix");
          }
          if (matrix2.isEmpty()) {
            throw new Error("Matrix must be non-empty");
          }
          let n = matrix2.columns;
          let V = new Matrix3(n, n);
          let d = new Float64Array(n);
          let e = new Float64Array(n);
          let value = matrix2;
          let i, j;
          let isSymmetric = false;
          if (assumeSymmetric) {
            isSymmetric = true;
          } else {
            isSymmetric = matrix2.isSymmetric();
          }
          if (isSymmetric) {
            for (i = 0; i < n; i++) {
              for (j = 0; j < n; j++) {
                V.set(i, j, value.get(i, j));
              }
            }
            tred2(n, e, d, V);
            tql2(n, e, d, V);
          } else {
            let H = new Matrix3(n, n);
            let ort = new Float64Array(n);
            for (j = 0; j < n; j++) {
              for (i = 0; i < n; i++) {
                H.set(i, j, value.get(i, j));
              }
            }
            orthes(n, H, ort, V);
            hqr2(n, e, d, V, H);
          }
          this.n = n;
          this.e = e;
          this.d = d;
          this.V = V;
        }
        get realEigenvalues() {
          return Array.from(this.d);
        }
        get imaginaryEigenvalues() {
          return Array.from(this.e);
        }
        get eigenvectorMatrix() {
          return this.V;
        }
        get diagonalMatrix() {
          let n = this.n;
          let e = this.e;
          let d = this.d;
          let X = new Matrix3(n, n);
          let i, j;
          for (i = 0; i < n; i++) {
            for (j = 0; j < n; j++) {
              X.set(i, j, 0);
            }
            X.set(i, i, d[i]);
            if (e[i] > 0) {
              X.set(i, i + 1, e[i]);
            } else if (e[i] < 0) {
              X.set(i, i - 1, e[i]);
            }
          }
          return X;
        }
      };
      function tred2(n, e, d, V) {
        let f, g, h, i, j, k, hh, scale;
        for (j = 0; j < n; j++) {
          d[j] = V.get(n - 1, j);
        }
        for (i = n - 1; i > 0; i--) {
          scale = 0;
          h = 0;
          for (k = 0; k < i; k++) {
            scale = scale + Math.abs(d[k]);
          }
          if (scale === 0) {
            e[i] = d[i - 1];
            for (j = 0; j < i; j++) {
              d[j] = V.get(i - 1, j);
              V.set(i, j, 0);
              V.set(j, i, 0);
            }
          } else {
            for (k = 0; k < i; k++) {
              d[k] /= scale;
              h += d[k] * d[k];
            }
            f = d[i - 1];
            g = Math.sqrt(h);
            if (f > 0) {
              g = -g;
            }
            e[i] = scale * g;
            h = h - f * g;
            d[i - 1] = f - g;
            for (j = 0; j < i; j++) {
              e[j] = 0;
            }
            for (j = 0; j < i; j++) {
              f = d[j];
              V.set(j, i, f);
              g = e[j] + V.get(j, j) * f;
              for (k = j + 1; k <= i - 1; k++) {
                g += V.get(k, j) * d[k];
                e[k] += V.get(k, j) * f;
              }
              e[j] = g;
            }
            f = 0;
            for (j = 0; j < i; j++) {
              e[j] /= h;
              f += e[j] * d[j];
            }
            hh = f / (h + h);
            for (j = 0; j < i; j++) {
              e[j] -= hh * d[j];
            }
            for (j = 0; j < i; j++) {
              f = d[j];
              g = e[j];
              for (k = j; k <= i - 1; k++) {
                V.set(k, j, V.get(k, j) - (f * e[k] + g * d[k]));
              }
              d[j] = V.get(i - 1, j);
              V.set(i, j, 0);
            }
          }
          d[i] = h;
        }
        for (i = 0; i < n - 1; i++) {
          V.set(n - 1, i, V.get(i, i));
          V.set(i, i, 1);
          h = d[i + 1];
          if (h !== 0) {
            for (k = 0; k <= i; k++) {
              d[k] = V.get(k, i + 1) / h;
            }
            for (j = 0; j <= i; j++) {
              g = 0;
              for (k = 0; k <= i; k++) {
                g += V.get(k, i + 1) * V.get(k, j);
              }
              for (k = 0; k <= i; k++) {
                V.set(k, j, V.get(k, j) - g * d[k]);
              }
            }
          }
          for (k = 0; k <= i; k++) {
            V.set(k, i + 1, 0);
          }
        }
        for (j = 0; j < n; j++) {
          d[j] = V.get(n - 1, j);
          V.set(n - 1, j, 0);
        }
        V.set(n - 1, n - 1, 1);
        e[0] = 0;
      }
      function tql2(n, e, d, V) {
        let g, h, i, j, k, l, m, p, r, dl1, c, c2, c3, el1, s, s2;
        for (i = 1; i < n; i++) {
          e[i - 1] = e[i];
        }
        e[n - 1] = 0;
        let f = 0;
        let tst1 = 0;
        let eps = Number.EPSILON;
        for (l = 0; l < n; l++) {
          tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
          m = l;
          while (m < n) {
            if (Math.abs(e[m]) <= eps * tst1) {
              break;
            }
            m++;
          }
          if (m > l) {
            do {
              g = d[l];
              p = (d[l + 1] - g) / (2 * e[l]);
              r = hypotenuse(p, 1);
              if (p < 0) {
                r = -r;
              }
              d[l] = e[l] / (p + r);
              d[l + 1] = e[l] * (p + r);
              dl1 = d[l + 1];
              h = g - d[l];
              for (i = l + 2; i < n; i++) {
                d[i] -= h;
              }
              f = f + h;
              p = d[m];
              c = 1;
              c2 = c;
              c3 = c;
              el1 = e[l + 1];
              s = 0;
              s2 = 0;
              for (i = m - 1; i >= l; i--) {
                c3 = c2;
                c2 = c;
                s2 = s;
                g = c * e[i];
                h = c * p;
                r = hypotenuse(p, e[i]);
                e[i + 1] = s * r;
                s = e[i] / r;
                c = p / r;
                p = c * d[i] - s * g;
                d[i + 1] = h + s * (c * g + s * d[i]);
                for (k = 0; k < n; k++) {
                  h = V.get(k, i + 1);
                  V.set(k, i + 1, s * V.get(k, i) + c * h);
                  V.set(k, i, c * V.get(k, i) - s * h);
                }
              }
              p = -s * s2 * c3 * el1 * e[l] / dl1;
              e[l] = s * p;
              d[l] = c * p;
            } while (Math.abs(e[l]) > eps * tst1);
          }
          d[l] = d[l] + f;
          e[l] = 0;
        }
        for (i = 0; i < n - 1; i++) {
          k = i;
          p = d[i];
          for (j = i + 1; j < n; j++) {
            if (d[j] < p) {
              k = j;
              p = d[j];
            }
          }
          if (k !== i) {
            d[k] = d[i];
            d[i] = p;
            for (j = 0; j < n; j++) {
              p = V.get(j, i);
              V.set(j, i, V.get(j, k));
              V.set(j, k, p);
            }
          }
        }
      }
      function orthes(n, H, ort, V) {
        let low = 0;
        let high = n - 1;
        let f, g, h, i, j, m;
        let scale;
        for (m = low + 1; m <= high - 1; m++) {
          scale = 0;
          for (i = m; i <= high; i++) {
            scale = scale + Math.abs(H.get(i, m - 1));
          }
          if (scale !== 0) {
            h = 0;
            for (i = high; i >= m; i--) {
              ort[i] = H.get(i, m - 1) / scale;
              h += ort[i] * ort[i];
            }
            g = Math.sqrt(h);
            if (ort[m] > 0) {
              g = -g;
            }
            h = h - ort[m] * g;
            ort[m] = ort[m] - g;
            for (j = m; j < n; j++) {
              f = 0;
              for (i = high; i >= m; i--) {
                f += ort[i] * H.get(i, j);
              }
              f = f / h;
              for (i = m; i <= high; i++) {
                H.set(i, j, H.get(i, j) - f * ort[i]);
              }
            }
            for (i = 0; i <= high; i++) {
              f = 0;
              for (j = high; j >= m; j--) {
                f += ort[j] * H.get(i, j);
              }
              f = f / h;
              for (j = m; j <= high; j++) {
                H.set(i, j, H.get(i, j) - f * ort[j]);
              }
            }
            ort[m] = scale * ort[m];
            H.set(m, m - 1, scale * g);
          }
        }
        for (i = 0; i < n; i++) {
          for (j = 0; j < n; j++) {
            V.set(i, j, i === j ? 1 : 0);
          }
        }
        for (m = high - 1; m >= low + 1; m--) {
          if (H.get(m, m - 1) !== 0) {
            for (i = m + 1; i <= high; i++) {
              ort[i] = H.get(i, m - 1);
            }
            for (j = m; j <= high; j++) {
              g = 0;
              for (i = m; i <= high; i++) {
                g += ort[i] * V.get(i, j);
              }
              g = g / ort[m] / H.get(m, m - 1);
              for (i = m; i <= high; i++) {
                V.set(i, j, V.get(i, j) + g * ort[i]);
              }
            }
          }
        }
      }
      function hqr2(nn, e, d, V, H) {
        let n = nn - 1;
        let low = 0;
        let high = nn - 1;
        let eps = Number.EPSILON;
        let exshift = 0;
        let norm = 0;
        let p = 0;
        let q = 0;
        let r = 0;
        let s = 0;
        let z = 0;
        let iter = 0;
        let i, j, k, l, m, t, w, x, y;
        let ra, sa, vr, vi;
        let notlast, cdivres;
        for (i = 0; i < nn; i++) {
          if (i < low || i > high) {
            d[i] = H.get(i, i);
            e[i] = 0;
          }
          for (j = Math.max(i - 1, 0); j < nn; j++) {
            norm = norm + Math.abs(H.get(i, j));
          }
        }
        while (n >= low) {
          l = n;
          while (l > low) {
            s = Math.abs(H.get(l - 1, l - 1)) + Math.abs(H.get(l, l));
            if (s === 0) {
              s = norm;
            }
            if (Math.abs(H.get(l, l - 1)) < eps * s) {
              break;
            }
            l--;
          }
          if (l === n) {
            H.set(n, n, H.get(n, n) + exshift);
            d[n] = H.get(n, n);
            e[n] = 0;
            n--;
            iter = 0;
          } else if (l === n - 1) {
            w = H.get(n, n - 1) * H.get(n - 1, n);
            p = (H.get(n - 1, n - 1) - H.get(n, n)) / 2;
            q = p * p + w;
            z = Math.sqrt(Math.abs(q));
            H.set(n, n, H.get(n, n) + exshift);
            H.set(n - 1, n - 1, H.get(n - 1, n - 1) + exshift);
            x = H.get(n, n);
            if (q >= 0) {
              z = p >= 0 ? p + z : p - z;
              d[n - 1] = x + z;
              d[n] = d[n - 1];
              if (z !== 0) {
                d[n] = x - w / z;
              }
              e[n - 1] = 0;
              e[n] = 0;
              x = H.get(n, n - 1);
              s = Math.abs(x) + Math.abs(z);
              p = x / s;
              q = z / s;
              r = Math.sqrt(p * p + q * q);
              p = p / r;
              q = q / r;
              for (j = n - 1; j < nn; j++) {
                z = H.get(n - 1, j);
                H.set(n - 1, j, q * z + p * H.get(n, j));
                H.set(n, j, q * H.get(n, j) - p * z);
              }
              for (i = 0; i <= n; i++) {
                z = H.get(i, n - 1);
                H.set(i, n - 1, q * z + p * H.get(i, n));
                H.set(i, n, q * H.get(i, n) - p * z);
              }
              for (i = low; i <= high; i++) {
                z = V.get(i, n - 1);
                V.set(i, n - 1, q * z + p * V.get(i, n));
                V.set(i, n, q * V.get(i, n) - p * z);
              }
            } else {
              d[n - 1] = x + p;
              d[n] = x + p;
              e[n - 1] = z;
              e[n] = -z;
            }
            n = n - 2;
            iter = 0;
          } else {
            x = H.get(n, n);
            y = 0;
            w = 0;
            if (l < n) {
              y = H.get(n - 1, n - 1);
              w = H.get(n, n - 1) * H.get(n - 1, n);
            }
            if (iter === 10) {
              exshift += x;
              for (i = low; i <= n; i++) {
                H.set(i, i, H.get(i, i) - x);
              }
              s = Math.abs(H.get(n, n - 1)) + Math.abs(H.get(n - 1, n - 2));
              x = y = 0.75 * s;
              w = -0.4375 * s * s;
            }
            if (iter === 30) {
              s = (y - x) / 2;
              s = s * s + w;
              if (s > 0) {
                s = Math.sqrt(s);
                if (y < x) {
                  s = -s;
                }
                s = x - w / ((y - x) / 2 + s);
                for (i = low; i <= n; i++) {
                  H.set(i, i, H.get(i, i) - s);
                }
                exshift += s;
                x = y = w = 0.964;
              }
            }
            iter = iter + 1;
            m = n - 2;
            while (m >= l) {
              z = H.get(m, m);
              r = x - z;
              s = y - z;
              p = (r * s - w) / H.get(m + 1, m) + H.get(m, m + 1);
              q = H.get(m + 1, m + 1) - z - r - s;
              r = H.get(m + 2, m + 1);
              s = Math.abs(p) + Math.abs(q) + Math.abs(r);
              p = p / s;
              q = q / s;
              r = r / s;
              if (m === l) {
                break;
              }
              if (Math.abs(H.get(m, m - 1)) * (Math.abs(q) + Math.abs(r)) < eps * (Math.abs(p) * (Math.abs(H.get(m - 1, m - 1)) + Math.abs(z) + Math.abs(H.get(m + 1, m + 1))))) {
                break;
              }
              m--;
            }
            for (i = m + 2; i <= n; i++) {
              H.set(i, i - 2, 0);
              if (i > m + 2) {
                H.set(i, i - 3, 0);
              }
            }
            for (k = m; k <= n - 1; k++) {
              notlast = k !== n - 1;
              if (k !== m) {
                p = H.get(k, k - 1);
                q = H.get(k + 1, k - 1);
                r = notlast ? H.get(k + 2, k - 1) : 0;
                x = Math.abs(p) + Math.abs(q) + Math.abs(r);
                if (x !== 0) {
                  p = p / x;
                  q = q / x;
                  r = r / x;
                }
              }
              if (x === 0) {
                break;
              }
              s = Math.sqrt(p * p + q * q + r * r);
              if (p < 0) {
                s = -s;
              }
              if (s !== 0) {
                if (k !== m) {
                  H.set(k, k - 1, -s * x);
                } else if (l !== m) {
                  H.set(k, k - 1, -H.get(k, k - 1));
                }
                p = p + s;
                x = p / s;
                y = q / s;
                z = r / s;
                q = q / p;
                r = r / p;
                for (j = k; j < nn; j++) {
                  p = H.get(k, j) + q * H.get(k + 1, j);
                  if (notlast) {
                    p = p + r * H.get(k + 2, j);
                    H.set(k + 2, j, H.get(k + 2, j) - p * z);
                  }
                  H.set(k, j, H.get(k, j) - p * x);
                  H.set(k + 1, j, H.get(k + 1, j) - p * y);
                }
                for (i = 0; i <= Math.min(n, k + 3); i++) {
                  p = x * H.get(i, k) + y * H.get(i, k + 1);
                  if (notlast) {
                    p = p + z * H.get(i, k + 2);
                    H.set(i, k + 2, H.get(i, k + 2) - p * r);
                  }
                  H.set(i, k, H.get(i, k) - p);
                  H.set(i, k + 1, H.get(i, k + 1) - p * q);
                }
                for (i = low; i <= high; i++) {
                  p = x * V.get(i, k) + y * V.get(i, k + 1);
                  if (notlast) {
                    p = p + z * V.get(i, k + 2);
                    V.set(i, k + 2, V.get(i, k + 2) - p * r);
                  }
                  V.set(i, k, V.get(i, k) - p);
                  V.set(i, k + 1, V.get(i, k + 1) - p * q);
                }
              }
            }
          }
        }
        if (norm === 0) {
          return;
        }
        for (n = nn - 1; n >= 0; n--) {
          p = d[n];
          q = e[n];
          if (q === 0) {
            l = n;
            H.set(n, n, 1);
            for (i = n - 1; i >= 0; i--) {
              w = H.get(i, i) - p;
              r = 0;
              for (j = l; j <= n; j++) {
                r = r + H.get(i, j) * H.get(j, n);
              }
              if (e[i] < 0) {
                z = w;
                s = r;
              } else {
                l = i;
                if (e[i] === 0) {
                  H.set(i, n, w !== 0 ? -r / w : -r / (eps * norm));
                } else {
                  x = H.get(i, i + 1);
                  y = H.get(i + 1, i);
                  q = (d[i] - p) * (d[i] - p) + e[i] * e[i];
                  t = (x * s - z * r) / q;
                  H.set(i, n, t);
                  H.set(
                    i + 1,
                    n,
                    Math.abs(x) > Math.abs(z) ? (-r - w * t) / x : (-s - y * t) / z
                  );
                }
                t = Math.abs(H.get(i, n));
                if (eps * t * t > 1) {
                  for (j = i; j <= n; j++) {
                    H.set(j, n, H.get(j, n) / t);
                  }
                }
              }
            }
          } else if (q < 0) {
            l = n - 1;
            if (Math.abs(H.get(n, n - 1)) > Math.abs(H.get(n - 1, n))) {
              H.set(n - 1, n - 1, q / H.get(n, n - 1));
              H.set(n - 1, n, -(H.get(n, n) - p) / H.get(n, n - 1));
            } else {
              cdivres = cdiv(0, -H.get(n - 1, n), H.get(n - 1, n - 1) - p, q);
              H.set(n - 1, n - 1, cdivres[0]);
              H.set(n - 1, n, cdivres[1]);
            }
            H.set(n, n - 1, 0);
            H.set(n, n, 1);
            for (i = n - 2; i >= 0; i--) {
              ra = 0;
              sa = 0;
              for (j = l; j <= n; j++) {
                ra = ra + H.get(i, j) * H.get(j, n - 1);
                sa = sa + H.get(i, j) * H.get(j, n);
              }
              w = H.get(i, i) - p;
              if (e[i] < 0) {
                z = w;
                r = ra;
                s = sa;
              } else {
                l = i;
                if (e[i] === 0) {
                  cdivres = cdiv(-ra, -sa, w, q);
                  H.set(i, n - 1, cdivres[0]);
                  H.set(i, n, cdivres[1]);
                } else {
                  x = H.get(i, i + 1);
                  y = H.get(i + 1, i);
                  vr = (d[i] - p) * (d[i] - p) + e[i] * e[i] - q * q;
                  vi = (d[i] - p) * 2 * q;
                  if (vr === 0 && vi === 0) {
                    vr = eps * norm * (Math.abs(w) + Math.abs(q) + Math.abs(x) + Math.abs(y) + Math.abs(z));
                  }
                  cdivres = cdiv(
                    x * r - z * ra + q * sa,
                    x * s - z * sa - q * ra,
                    vr,
                    vi
                  );
                  H.set(i, n - 1, cdivres[0]);
                  H.set(i, n, cdivres[1]);
                  if (Math.abs(x) > Math.abs(z) + Math.abs(q)) {
                    H.set(
                      i + 1,
                      n - 1,
                      (-ra - w * H.get(i, n - 1) + q * H.get(i, n)) / x
                    );
                    H.set(
                      i + 1,
                      n,
                      (-sa - w * H.get(i, n) - q * H.get(i, n - 1)) / x
                    );
                  } else {
                    cdivres = cdiv(
                      -r - y * H.get(i, n - 1),
                      -s - y * H.get(i, n),
                      z,
                      q
                    );
                    H.set(i + 1, n - 1, cdivres[0]);
                    H.set(i + 1, n, cdivres[1]);
                  }
                }
                t = Math.max(Math.abs(H.get(i, n - 1)), Math.abs(H.get(i, n)));
                if (eps * t * t > 1) {
                  for (j = i; j <= n; j++) {
                    H.set(j, n - 1, H.get(j, n - 1) / t);
                    H.set(j, n, H.get(j, n) / t);
                  }
                }
              }
            }
          }
        }
        for (i = 0; i < nn; i++) {
          if (i < low || i > high) {
            for (j = i; j < nn; j++) {
              V.set(i, j, H.get(i, j));
            }
          }
        }
        for (j = nn - 1; j >= low; j--) {
          for (i = low; i <= high; i++) {
            z = 0;
            for (k = low; k <= Math.min(j, high); k++) {
              z = z + V.get(i, k) * H.get(k, j);
            }
            V.set(i, j, z);
          }
        }
      }
      function cdiv(xr, xi, yr, yi) {
        let r, d;
        if (Math.abs(yr) > Math.abs(yi)) {
          r = yi / yr;
          d = yr + r * yi;
          return [(xr + r * xi) / d, (xi - r * xr) / d];
        } else {
          r = yr / yi;
          d = yi + r * yr;
          return [(r * xr + xi) / d, (r * xi - xr) / d];
        }
      }
      var CholeskyDecomposition2 = class {
        constructor(value) {
          value = WrapperMatrix2D3.checkMatrix(value);
          if (!value.isSymmetric()) {
            throw new Error("Matrix is not symmetric");
          }
          let a = value;
          let dimension = a.rows;
          let l = new Matrix3(dimension, dimension);
          let positiveDefinite = true;
          let i, j, k;
          for (j = 0; j < dimension; j++) {
            let d = 0;
            for (k = 0; k < j; k++) {
              let s = 0;
              for (i = 0; i < k; i++) {
                s += l.get(k, i) * l.get(j, i);
              }
              s = (a.get(j, k) - s) / l.get(k, k);
              l.set(j, k, s);
              d = d + s * s;
            }
            d = a.get(j, j) - d;
            positiveDefinite &&= d > 0;
            l.set(j, j, Math.sqrt(Math.max(d, 0)));
            for (k = j + 1; k < dimension; k++) {
              l.set(j, k, 0);
            }
          }
          this.L = l;
          this.positiveDefinite = positiveDefinite;
        }
        isPositiveDefinite() {
          return this.positiveDefinite;
        }
        solve(value) {
          value = WrapperMatrix2D3.checkMatrix(value);
          let l = this.L;
          let dimension = l.rows;
          if (value.rows !== dimension) {
            throw new Error("Matrix dimensions do not match");
          }
          if (this.isPositiveDefinite() === false) {
            throw new Error("Matrix is not positive definite");
          }
          let count = value.columns;
          let B = value.clone();
          let i, j, k;
          for (k = 0; k < dimension; k++) {
            for (j = 0; j < count; j++) {
              for (i = 0; i < k; i++) {
                B.set(k, j, B.get(k, j) - B.get(i, j) * l.get(k, i));
              }
              B.set(k, j, B.get(k, j) / l.get(k, k));
            }
          }
          for (k = dimension - 1; k >= 0; k--) {
            for (j = 0; j < count; j++) {
              for (i = k + 1; i < dimension; i++) {
                B.set(k, j, B.get(k, j) - B.get(i, j) * l.get(i, k));
              }
              B.set(k, j, B.get(k, j) / l.get(k, k));
            }
          }
          return B;
        }
        get lowerTriangularMatrix() {
          return this.L;
        }
      };
      var nipals = class {
        constructor(X, options = {}) {
          X = WrapperMatrix2D3.checkMatrix(X);
          let { Y } = options;
          const {
            scaleScores = false,
            maxIterations = 1e3,
            terminationCriteria = 1e-10
          } = options;
          let u;
          if (Y) {
            if (isAnyArray4.isAnyArray(Y) && typeof Y[0] === "number") {
              Y = Matrix3.columnVector(Y);
            } else {
              Y = WrapperMatrix2D3.checkMatrix(Y);
            }
            if (Y.rows !== X.rows) {
              throw new Error("Y should have the same number of rows as X");
            }
            u = Y.getColumnVector(0);
          } else {
            u = X.getColumnVector(0);
          }
          let diff = 1;
          let t, q, w, tOld;
          for (let counter = 0; counter < maxIterations && diff > terminationCriteria; counter++) {
            w = X.transpose().mmul(u).div(u.transpose().mmul(u).get(0, 0));
            w = w.div(w.norm());
            t = X.mmul(w).div(w.transpose().mmul(w).get(0, 0));
            if (counter > 0) {
              diff = t.clone().sub(tOld).pow(2).sum();
            }
            tOld = t.clone();
            if (Y) {
              q = Y.transpose().mmul(t).div(t.transpose().mmul(t).get(0, 0));
              q = q.div(q.norm());
              u = Y.mmul(q).div(q.transpose().mmul(q).get(0, 0));
            } else {
              u = t;
            }
          }
          if (Y) {
            let p = X.transpose().mmul(t).div(t.transpose().mmul(t).get(0, 0));
            p = p.div(p.norm());
            let xResidual = X.clone().sub(t.clone().mmul(p.transpose()));
            let residual = u.transpose().mmul(t).div(t.transpose().mmul(t).get(0, 0));
            let yResidual = Y.clone().sub(
              t.clone().mulS(residual.get(0, 0)).mmul(q.transpose())
            );
            this.t = t;
            this.p = p.transpose();
            this.w = w.transpose();
            this.q = q;
            this.u = u;
            this.s = t.transpose().mmul(t);
            this.xResidual = xResidual;
            this.yResidual = yResidual;
            this.betas = residual;
          } else {
            this.w = w.transpose();
            this.s = t.transpose().mmul(t).sqrt();
            if (scaleScores) {
              this.t = t.clone().div(this.s.get(0, 0));
            } else {
              this.t = t;
            }
            this.xResidual = X.sub(t.mmul(w.transpose()));
          }
        }
      };
      exports.AbstractMatrix = AbstractMatrix2;
      exports.CHO = CholeskyDecomposition2;
      exports.CholeskyDecomposition = CholeskyDecomposition2;
      exports.DistanceMatrix = DistanceMatrix2;
      exports.EVD = EigenvalueDecomposition2;
      exports.EigenvalueDecomposition = EigenvalueDecomposition2;
      exports.LU = LuDecomposition2;
      exports.LuDecomposition = LuDecomposition2;
      exports.Matrix = Matrix3;
      exports.MatrixColumnSelectionView = MatrixColumnSelectionView3;
      exports.MatrixColumnView = MatrixColumnView2;
      exports.MatrixFlipColumnView = MatrixFlipColumnView2;
      exports.MatrixFlipRowView = MatrixFlipRowView2;
      exports.MatrixRowSelectionView = MatrixRowSelectionView2;
      exports.MatrixRowView = MatrixRowView2;
      exports.MatrixSelectionView = MatrixSelectionView2;
      exports.MatrixSubView = MatrixSubView2;
      exports.MatrixTransposeView = MatrixTransposeView3;
      exports.NIPALS = nipals;
      exports.Nipals = nipals;
      exports.QR = QrDecomposition2;
      exports.QrDecomposition = QrDecomposition2;
      exports.SVD = SingularValueDecomposition2;
      exports.SingularValueDecomposition = SingularValueDecomposition2;
      exports.SymmetricMatrix = SymmetricMatrix2;
      exports.WrapperMatrix1D = WrapperMatrix1D2;
      exports.WrapperMatrix2D = WrapperMatrix2D3;
      exports.correlation = correlation2;
      exports.covariance = covariance2;
      exports.default = Matrix3;
      exports.determinant = determinant2;
      exports.inverse = inverse2;
      exports.linearDependencies = linearDependencies2;
      exports.pseudoInverse = pseudoInverse2;
      exports.solve = solve2;
      exports.wrap = wrap2;
    }
  });

  // node_modules/ml-matrix/matrix.mjs
  var matrix, Matrix2, MatrixColumnSelectionView2, MatrixTransposeView2, WrapperMatrix2D2, matrix_default;
  var init_matrix = __esm({
    "node_modules/ml-matrix/matrix.mjs"() {
      matrix = __toESM(require_matrix(), 1);
      Matrix2 = matrix.Matrix;
      MatrixColumnSelectionView2 = matrix.MatrixColumnSelectionView;
      MatrixTransposeView2 = matrix.MatrixTransposeView;
      WrapperMatrix2D2 = matrix.WrapperMatrix2D;
      matrix_default = matrix.default.Matrix ? matrix.default.Matrix : matrix.Matrix;
    }
  });

  // node_modules/ml-array-sum/lib-es6/index.js
  function sum(input) {
    if (!(0, import_is_any_array.isAnyArray)(input)) {
      throw new TypeError("input must be an array");
    }
    if (input.length === 0) {
      throw new TypeError("input must not be empty");
    }
    var sumValue = 0;
    for (var i = 0; i < input.length; i++) {
      sumValue += input[i];
    }
    return sumValue;
  }
  var import_is_any_array;
  var init_lib_es6 = __esm({
    "node_modules/ml-array-sum/lib-es6/index.js"() {
      import_is_any_array = __toESM(require_lib());
    }
  });

  // node_modules/ml-array-mean/lib-es6/index.js
  function mean(input) {
    return sum(input) / input.length;
  }
  var init_lib_es62 = __esm({
    "node_modules/ml-array-mean/lib-es6/index.js"() {
      init_lib_es6();
    }
  });

  // node_modules/ml-cart/src/utils.js
  function toDiscreteDistribution(array, numberOfClasses) {
    let counts = new Array(numberOfClasses).fill(0);
    for (let i = 0; i < array.length; ++i) {
      counts[array[i]] += 1 / array.length;
    }
    return Matrix2.rowVector(counts);
  }
  function giniImpurity(array) {
    if (array.length === 0) {
      return 0;
    }
    let probabilities = toDiscreteDistribution(
      array,
      getNumberOfClasses(array)
    ).getRow(0);
    let sum2 = 0;
    for (let i = 0; i < probabilities.length; ++i) {
      sum2 += probabilities[i] * probabilities[i];
    }
    return 1 - sum2;
  }
  function getNumberOfClasses(array) {
    return array.filter((val, i, arr) => {
      return arr.indexOf(val) === i;
    }).map((val) => val + 1).reduce((a, b) => Math.max(a, b));
  }
  function giniGain(array, splitted) {
    let splitsImpurity = 0;
    let splits = ["greater", "lesser"];
    for (let i = 0; i < splits.length; ++i) {
      let currentSplit = splitted[splits[i]];
      splitsImpurity += giniImpurity(currentSplit) * currentSplit.length / array.length;
    }
    return giniImpurity(array) - splitsImpurity;
  }
  function squaredError(array) {
    let l = array.length;
    if (l === 0) {
      return 0;
    }
    let m = mean(array);
    let error = 0;
    for (let i = 0; i < l; ++i) {
      let currentElement = array[i];
      error += (currentElement - m) * (currentElement - m);
    }
    return error;
  }
  function regressionError(array, splitted) {
    let error = 0;
    let splits = ["greater", "lesser"];
    for (let i = 0; i < splits.length; ++i) {
      let currentSplit = splitted[splits[i]];
      error += squaredError(currentSplit);
    }
    return error;
  }
  function matrixSplitter(X, y, column, value) {
    let lesserX = [];
    let greaterX = [];
    let lesserY = [];
    let greaterY = [];
    for (let i = 0; i < X.rows; ++i) {
      if (X.get(i, column) < value) {
        lesserX.push(X.getRow(i));
        lesserY.push(y[i]);
      } else {
        greaterX.push(X.getRow(i));
        greaterY.push(y[i]);
      }
    }
    return {
      greaterX,
      greaterY,
      lesserX,
      lesserY
    };
  }
  function mean2(a, b) {
    return (a + b) / 2;
  }
  function zip(a, b) {
    if (a.length !== b.length) {
      throw new TypeError(
        `Error on zip: the size of a: ${a.length} is different from b: ${b.length}`
      );
    }
    let ret = new Array(a.length);
    for (let i = 0; i < a.length; ++i) {
      ret[i] = [a[i], b[i]];
    }
    return ret;
  }
  var init_utils = __esm({
    "node_modules/ml-cart/src/utils.js"() {
      init_lib_es62();
      init_matrix();
    }
  });

  // node_modules/ml-cart/src/TreeNode.js
  var gainFunctions, splitFunctions, TreeNode;
  var init_TreeNode = __esm({
    "node_modules/ml-cart/src/TreeNode.js"() {
      init_lib_es62();
      init_matrix();
      init_utils();
      gainFunctions = {
        gini: giniGain,
        regression: regressionError
      };
      splitFunctions = {
        mean: mean2
      };
      TreeNode = class _TreeNode {
        /**
         * @private
         * Constructor for a tree node given the options received on the main classes (DecisionTreeClassifier, DecisionTreeRegression)
         * @param {object|TreeNode} options for loading
         * @constructor
         */
        constructor(options) {
          this.kind = options.kind;
          this.gainFunction = options.gainFunction;
          this.splitFunction = options.splitFunction;
          this.minNumSamples = options.minNumSamples;
          this.maxDepth = options.maxDepth;
          this.gainThreshold = options.gainThreshold || 0;
        }
        /**
         * @private
         * Function that retrieve the best feature to make the split.
         * @param {Matrix} XTranspose - Training set transposed
         * @param {Array} y - labels or values (depending of the decision tree)
         * @return {object} - return tree values, the best gain, column and the split value.
         */
        bestSplit(XTranspose, y) {
          let bestGain = this.kind === "classifier" ? -Infinity : Infinity;
          let check = this.kind === "classifier" ? (a, b) => a > b : (a, b) => a < b;
          let maxColumn;
          let maxValue;
          let numberSamples;
          for (let i = 0; i < XTranspose.rows; ++i) {
            let currentFeature = XTranspose.getRow(i);
            let splitValues = this.featureSplit(currentFeature, y);
            for (let j = 0; j < splitValues.length; ++j) {
              let currentSplitVal = splitValues[j];
              let splitted = this.split(currentFeature, y, currentSplitVal);
              let gain = gainFunctions[this.gainFunction](y, splitted);
              if (check(gain, bestGain)) {
                maxColumn = i;
                maxValue = currentSplitVal;
                bestGain = gain;
                numberSamples = currentFeature.length;
              }
            }
          }
          return {
            maxGain: bestGain,
            maxColumn,
            maxValue,
            numberSamples
          };
        }
        /**
         * @private
         * Makes the split of the training labels or values from the training set feature given a split value.
         * @param {Array} x - Training set feature
         * @param {Array} y - Training set value or label
         * @param {number} splitValue
         * @return {object}
         */
        split(x, y, splitValue) {
          let lesser = [];
          let greater = [];
          for (let i = 0; i < x.length; ++i) {
            if (x[i] < splitValue) {
              lesser.push(y[i]);
            } else {
              greater.push(y[i]);
            }
          }
          return {
            greater,
            lesser
          };
        }
        /**
         * @private
         * Calculates the possible points to split over the tree given a training set feature and corresponding labels or values.
         * @param {Array} x - Training set feature
         * @param {Array} y - Training set value or label
         * @return {Array} possible split values.
         */
        featureSplit(x, y) {
          let splitValues = [];
          let arr = zip(x, y);
          arr.sort((a, b) => {
            return a[0] - b[0];
          });
          for (let i = 1; i < arr.length; ++i) {
            if (arr[i - 1][1] !== arr[i][1]) {
              splitValues.push(
                splitFunctions[this.splitFunction](arr[i - 1][0], arr[i][0])
              );
            }
          }
          return splitValues;
        }
        /**
         * @private
         * Calculate the predictions of a leaf tree node given the training labels or values
         * @param {Array} y
         */
        calculatePrediction(y) {
          if (this.kind === "classifier") {
            this.distribution = toDiscreteDistribution(
              y,
              getNumberOfClasses(y)
            );
            if (this.distribution.columns === 0) {
              throw new TypeError("Error on calculate the prediction");
            }
          } else {
            this.distribution = mean(y);
          }
        }
        /**
         * @private
         * Train a node given the training set and labels, because it trains recursively, it also receive
         * the current depth of the node, parent gain to avoid infinite recursion and boolean value to check if
         * the training set is transposed.
         * @param {Matrix} X - Training set (could be transposed or not given transposed).
         * @param {Array} y - Training labels or values.
         * @param {number} currentDepth - Current depth of the node.
         * @param {number} parentGain - parent node gain or error.
         */
        train(X, y, currentDepth, parentGain) {
          if (X.rows <= this.minNumSamples) {
            this.calculatePrediction(y);
            return;
          }
          if (parentGain === void 0) parentGain = 0;
          let XTranspose = X.transpose();
          let split = this.bestSplit(XTranspose, y);
          this.splitValue = split.maxValue;
          this.splitColumn = split.maxColumn;
          this.gain = split.maxGain;
          this.numberSamples = split.numberSamples;
          let splittedMatrix = matrixSplitter(
            X,
            y,
            this.splitColumn,
            this.splitValue
          );
          if (currentDepth < this.maxDepth && this.gain > this.gainThreshold && this.gain !== parentGain && splittedMatrix.lesserX.length > 0 && splittedMatrix.greaterX.length > 0) {
            this.left = new _TreeNode(this);
            this.right = new _TreeNode(this);
            let lesserX = new Matrix2(splittedMatrix.lesserX);
            let greaterX = new Matrix2(splittedMatrix.greaterX);
            this.left.train(
              lesserX,
              splittedMatrix.lesserY,
              currentDepth + 1,
              this.gain
            );
            this.right.train(
              greaterX,
              splittedMatrix.greaterY,
              currentDepth + 1,
              this.gain
            );
          } else {
            this.calculatePrediction(y);
          }
        }
        /**
         * @private
         * Calculates the prediction of a given element.
         * @param {Array} row
         * @return {number|Array} prediction
         *          * if a node is a classifier returns an array of probabilities of each class.
         *          * if a node is for regression returns a number with the prediction.
         */
        classify(row) {
          if (this.right && this.left) {
            if (row[this.splitColumn] < this.splitValue) {
              return this.left.classify(row);
            } else {
              return this.right.classify(row);
            }
          }
          return this.distribution;
        }
        /**
         * @private
         * Set the parameter of the current node and their children.
         * @param {object} node - parameters of the current node and the children.
         */
        setNodeParameters(node) {
          if (node.distribution !== void 0) {
            this.distribution = node.distribution.constructor === Array ? new Matrix2(node.distribution) : node.distribution;
          } else {
            this.distribution = void 0;
            this.splitValue = node.splitValue;
            this.splitColumn = node.splitColumn;
            this.gain = node.gain;
            this.left = new _TreeNode(this);
            this.right = new _TreeNode(this);
            if (node.left !== {}) {
              this.left.setNodeParameters(node.left);
            }
            if (node.right !== {}) {
              this.right.setNodeParameters(node.right);
            }
          }
        }
      };
    }
  });

  // node_modules/ml-cart/src/DecisionTreeClassifier.js
  var defaultOptions, DecisionTreeClassifier;
  var init_DecisionTreeClassifier = __esm({
    "node_modules/ml-cart/src/DecisionTreeClassifier.js"() {
      init_matrix();
      init_TreeNode();
      defaultOptions = {
        gainFunction: "gini",
        splitFunction: "mean",
        minNumSamples: 3,
        maxDepth: Infinity,
        gainThreshold: 0.01
      };
      DecisionTreeClassifier = class _DecisionTreeClassifier {
        /**
         * Create new Decision Tree Classifier with CART implementation with the given options
         * @param {object} options
         * @param {string} [options.gainFunction="gini"] - gain function to get the best split, "gini" the only one supported.
         * @param {string} [options.splitFunction="mean"] - given two integers from a split feature, get the value to split, "mean" the only one supported.
         * @param {number} [options.minNumSamples=3] - minimum number of samples to create a leaf node to decide a class.
         * @param {number} [options.maxDepth=Infinity] - Max depth of the tree.
         * @param {object} model - for load purposes.
         * @constructor
         */
        constructor(options, model) {
          if (options === true) {
            this.options = model.options;
            this.root = new TreeNode(model.options);
            this.root.setNodeParameters(model.root);
          } else {
            this.options = Object.assign({}, defaultOptions, options);
            this.options.kind = "classifier";
          }
        }
        /**
         * Train the decision tree with the given training set and labels.
         * @param {Matrix|MatrixTransposeView|Array} trainingSet
         * @param {Array} trainingLabels
         */
        train(trainingSet, trainingLabels) {
          this.root = new TreeNode(this.options);
          trainingSet = Matrix2.checkMatrix(trainingSet);
          this.root.train(trainingSet, trainingLabels, 0, null);
        }
        /**
         * Predicts the output given the matrix to predict.
         * @param {Matrix|MatrixTransposeView|Array} toPredict
         * @return {Array} predictions
         */
        predict(toPredict) {
          toPredict = Matrix2.checkMatrix(toPredict);
          let predictions = new Array(toPredict.rows);
          for (let i = 0; i < toPredict.rows; ++i) {
            predictions[i] = this.root.classify(toPredict.getRow(i)).maxRowIndex(0)[1];
          }
          return predictions;
        }
        /**
         * Export the current model to JSON.
         * @return {object} - Current model.
         */
        toJSON() {
          return {
            options: this.options,
            root: this.root,
            name: "DTClassifier"
          };
        }
        /**
         * Load a Decision tree classifier with the given model.
         * @param {object} model
         * @return {DecisionTreeClassifier}
         */
        static load(model) {
          if (model.name !== "DTClassifier") {
            throw new RangeError(`Invalid model: ${model.name}`);
          }
          return new _DecisionTreeClassifier(true, model);
        }
      };
    }
  });

  // node_modules/ml-cart/src/DecisionTreeRegression.js
  var defaultOptions2, DecisionTreeRegression;
  var init_DecisionTreeRegression = __esm({
    "node_modules/ml-cart/src/DecisionTreeRegression.js"() {
      init_matrix();
      init_TreeNode();
      defaultOptions2 = {
        gainFunction: "regression",
        splitFunction: "mean",
        minNumSamples: 3,
        maxDepth: Infinity
      };
      DecisionTreeRegression = class _DecisionTreeRegression {
        /**
         * Create new Decision Tree Regression with CART implementation with the given options.
         * @param {object} options
         * @param {string} [options.gainFunction="regression"] - gain function to get the best split, "regression" the only one supported.
         * @param {string} [options.splitFunction="mean"] - given two integers from a split feature, get the value to split, "mean" the only one supported.
         * @param {number} [options.minNumSamples=3] - minimum number of samples to create a leaf node to decide a class.
         * @param {number} [options.maxDepth=Infinity] - Max depth of the tree.
         * @param {object} model - for load purposes.
         */
        constructor(options, model) {
          if (options === true) {
            this.options = model.options;
            this.root = new TreeNode(model.options);
            this.root.setNodeParameters(model.root);
          } else {
            this.options = Object.assign({}, defaultOptions2, options);
            this.options.kind = "regression";
          }
        }
        /**
         * Train the decision tree with the given training set and values.
         * @param {Matrix|MatrixTransposeView|Array} trainingSet
         * @param {Array} trainingValues
         */
        train(trainingSet, trainingValues) {
          this.root = new TreeNode(this.options);
          if (typeof trainingSet[0] !== "undefined" && trainingSet[0].length === void 0) {
            trainingSet = Matrix2.columnVector(trainingSet);
          } else {
            trainingSet = Matrix2.checkMatrix(trainingSet);
          }
          this.root.train(trainingSet, trainingValues, 0);
        }
        /**
         * Predicts the values given the matrix to predict.
         * @param {Matrix|MatrixTransposeView|Array} toPredict
         * @return {Array} predictions
         */
        predict(toPredict) {
          if (typeof toPredict[0] !== "undefined" && toPredict[0].length === void 0) {
            toPredict = Matrix2.columnVector(toPredict);
          }
          toPredict = Matrix2.checkMatrix(toPredict);
          let predictions = new Array(toPredict.rows);
          for (let i = 0; i < toPredict.rows; ++i) {
            predictions[i] = this.root.classify(toPredict.getRow(i));
          }
          return predictions;
        }
        /**
         * Export the current model to JSON.
         * @return {object} - Current model.
         */
        toJSON() {
          return {
            options: this.options,
            root: this.root,
            name: "DTRegression"
          };
        }
        /**
         * Load a Decision tree regression with the given model.
         * @param {object} model
         * @return {DecisionTreeRegression}
         */
        static load(model) {
          if (model.name !== "DTRegression") {
            throw new RangeError(`Invalid model:${model.name}`);
          }
          return new _DecisionTreeRegression(true, model);
        }
      };
    }
  });

  // node_modules/ml-cart/src/index.js
  var init_src = __esm({
    "node_modules/ml-cart/src/index.js"() {
      init_DecisionTreeClassifier();
      init_DecisionTreeRegression();
    }
  });

  // node_modules/ml-array-mode/lib-es6/index.js
  function mode(input) {
    if (!(0, import_is_any_array2.isAnyArray)(input)) {
      throw new TypeError("input must be an array");
    }
    if (input.length === 0) {
      throw new TypeError("input must not be empty");
    }
    var maxValue = 0;
    var maxCount = 0;
    var count = 0;
    var counts = {};
    for (var i = 0; i < input.length; ++i) {
      var element = input[i];
      count = counts[element];
      if (count) {
        counts[element]++;
        count++;
      } else {
        counts[element] = count = 1;
      }
      if (count > maxCount) {
        maxCount = count;
        maxValue = input[i];
      }
    }
    return maxValue;
  }
  var import_is_any_array2;
  var init_lib_es63 = __esm({
    "node_modules/ml-array-mode/lib-es6/index.js"() {
      import_is_any_array2 = __toESM(require_lib());
    }
  });

  // node_modules/random-js/dist/random-js.esm.js
  function int32(engine) {
    return engine.next() | 0;
  }
  function add(distribution, addend) {
    if (addend === 0) {
      return distribution;
    } else {
      return (engine) => distribution(engine) + addend;
    }
  }
  function int53(engine) {
    const high = engine.next() | 0;
    const low = engine.next() >>> 0;
    return (high & UINT21_MAX) * UINT32_SIZE + low + (high & UINT21_SIZE ? -SMALLEST_UNSAFE_INTEGER : 0);
  }
  function int53Full(engine) {
    while (true) {
      const high = engine.next() | 0;
      if (high & 4194304) {
        if ((high & 8388607) === 4194304 && (engine.next() | 0) === 0) {
          return SMALLEST_UNSAFE_INTEGER;
        }
      } else {
        const low = engine.next() >>> 0;
        return (high & UINT21_MAX) * UINT32_SIZE + low + (high & UINT21_SIZE ? -SMALLEST_UNSAFE_INTEGER : 0);
      }
    }
  }
  function uint32(engine) {
    return engine.next() >>> 0;
  }
  function uint53(engine) {
    const high = engine.next() & UINT21_MAX;
    const low = engine.next() >>> 0;
    return high * UINT32_SIZE + low;
  }
  function uint53Full(engine) {
    while (true) {
      const high = engine.next() | 0;
      if (high & UINT21_SIZE) {
        if ((high & UINT21_MAX) === 0 && (engine.next() | 0) === 0) {
          return SMALLEST_UNSAFE_INTEGER;
        }
      } else {
        const low = engine.next() >>> 0;
        return (high & UINT21_MAX) * UINT32_SIZE + low;
      }
    }
  }
  function isPowerOfTwoMinusOne(value) {
    return (value + 1 & value) === 0;
  }
  function bitmask(masking) {
    return (engine) => engine.next() & masking;
  }
  function downscaleToLoopCheckedRange(range) {
    const extendedRange = range + 1;
    const maximum = extendedRange * Math.floor(UINT32_SIZE / extendedRange);
    return (engine) => {
      let value = 0;
      do {
        value = engine.next() >>> 0;
      } while (value >= maximum);
      return value % extendedRange;
    };
  }
  function downscaleToRange(range) {
    if (isPowerOfTwoMinusOne(range)) {
      return bitmask(range);
    } else {
      return downscaleToLoopCheckedRange(range);
    }
  }
  function isEvenlyDivisibleByMaxInt32(value) {
    return (value | 0) === 0;
  }
  function upscaleWithHighMasking(masking) {
    return (engine) => {
      const high = engine.next() & masking;
      const low = engine.next() >>> 0;
      return high * UINT32_SIZE + low;
    };
  }
  function upscaleToLoopCheckedRange(extendedRange) {
    const maximum = extendedRange * Math.floor(SMALLEST_UNSAFE_INTEGER / extendedRange);
    return (engine) => {
      let ret = 0;
      do {
        const high = engine.next() & UINT21_MAX;
        const low = engine.next() >>> 0;
        ret = high * UINT32_SIZE + low;
      } while (ret >= maximum);
      return ret % extendedRange;
    };
  }
  function upscaleWithinU53(range) {
    const extendedRange = range + 1;
    if (isEvenlyDivisibleByMaxInt32(extendedRange)) {
      const highRange = (extendedRange / UINT32_SIZE | 0) - 1;
      if (isPowerOfTwoMinusOne(highRange)) {
        return upscaleWithHighMasking(highRange);
      }
    }
    return upscaleToLoopCheckedRange(extendedRange);
  }
  function upscaleWithinI53AndLoopCheck(min, max) {
    return (engine) => {
      let ret = 0;
      do {
        const high = engine.next() | 0;
        const low = engine.next() >>> 0;
        ret = (high & UINT21_MAX) * UINT32_SIZE + low + (high & UINT21_SIZE ? -SMALLEST_UNSAFE_INTEGER : 0);
      } while (ret < min || ret > max);
      return ret;
    };
  }
  function integer(min, max) {
    min = Math.floor(min);
    max = Math.floor(max);
    if (min < -SMALLEST_UNSAFE_INTEGER || !isFinite(min)) {
      throw new RangeError(`Expected min to be at least ${-SMALLEST_UNSAFE_INTEGER}`);
    } else if (max > SMALLEST_UNSAFE_INTEGER || !isFinite(max)) {
      throw new RangeError(`Expected max to be at most ${SMALLEST_UNSAFE_INTEGER}`);
    }
    const range = max - min;
    if (range <= 0 || !isFinite(range)) {
      return () => min;
    } else if (range === UINT32_MAX) {
      if (min === 0) {
        return uint32;
      } else {
        return add(int32, min + INT32_SIZE);
      }
    } else if (range < UINT32_MAX) {
      return add(downscaleToRange(range), min);
    } else if (range === LARGEST_SAFE_INTEGER) {
      return add(uint53, min);
    } else if (range < LARGEST_SAFE_INTEGER) {
      return add(upscaleWithinU53(range), min);
    } else if (max - 1 - min === LARGEST_SAFE_INTEGER) {
      return add(uint53Full, min);
    } else if (min === -SMALLEST_UNSAFE_INTEGER && max === SMALLEST_UNSAFE_INTEGER) {
      return int53Full;
    } else if (min === -SMALLEST_UNSAFE_INTEGER && max === LARGEST_SAFE_INTEGER) {
      return int53;
    } else if (min === -LARGEST_SAFE_INTEGER && max === SMALLEST_UNSAFE_INTEGER) {
      return add(int53, 1);
    } else if (max === SMALLEST_UNSAFE_INTEGER) {
      return add(upscaleWithinI53AndLoopCheck(min - 1, max - 1), 1);
    } else {
      return upscaleWithinI53AndLoopCheck(min, max);
    }
  }
  function string(pool = DEFAULT_STRING_POOL) {
    const poolLength = pool.length;
    if (!poolLength) {
      throw new Error("Expected pool not to be an empty string");
    }
    const distribution = integer(0, poolLength - 1);
    return (engine, length) => {
      let result = "";
      for (let i = 0; i < length; ++i) {
        const j = distribution(engine);
        result += pool.charAt(j);
      }
      return result;
    };
  }
  function createEntropy(engine = nativeMath, length = 16) {
    const array = [];
    array.push((/* @__PURE__ */ new Date()).getTime() | 0);
    for (let i = 1; i < length; ++i) {
      array[i] = engine.next() | 0;
    }
    return array;
  }
  function refreshData(data) {
    let k = 0;
    let tmp = 0;
    for (; (k | 0) < ARRAY_SIZE_MINUS_M; k = k + 1 | 0) {
      tmp = data[k] & INT32_SIZE | data[k + 1 | 0] & INT32_MAX;
      data[k] = data[k + M | 0] ^ tmp >>> 1 ^ (tmp & 1 ? A : 0);
    }
    for (; (k | 0) < ARRAY_MAX; k = k + 1 | 0) {
      tmp = data[k] & INT32_SIZE | data[k + 1 | 0] & INT32_MAX;
      data[k] = data[k - ARRAY_SIZE_MINUS_M | 0] ^ tmp >>> 1 ^ (tmp & 1 ? A : 0);
    }
    tmp = data[ARRAY_MAX] & INT32_SIZE | data[0] & INT32_MAX;
    data[ARRAY_MAX] = data[M - 1] ^ tmp >>> 1 ^ (tmp & 1 ? A : 0);
  }
  function temper(value) {
    value ^= value >>> 11;
    value ^= value << 7 & 2636928640;
    value ^= value << 15 & 4022730752;
    return value ^ value >>> 18;
  }
  function seedWithArray(data, source) {
    let i = 1;
    let j = 0;
    const sourceLength = source.length;
    let k = Math.max(sourceLength, ARRAY_SIZE) | 0;
    let previous = data[0] | 0;
    for (; (k | 0) > 0; --k) {
      data[i] = previous = (data[i] ^ imul(previous ^ previous >>> 30, 1664525)) + (source[j] | 0) + (j | 0) | 0;
      i = i + 1 | 0;
      ++j;
      if ((i | 0) > ARRAY_MAX) {
        data[0] = data[ARRAY_MAX];
        i = 1;
      }
      if (j >= sourceLength) {
        j = 0;
      }
    }
    for (k = ARRAY_MAX; (k | 0) > 0; --k) {
      data[i] = previous = (data[i] ^ imul(previous ^ previous >>> 30, 1566083941)) - i | 0;
      i = i + 1 | 0;
      if ((i | 0) > ARRAY_MAX) {
        data[0] = data[ARRAY_MAX];
        i = 1;
      }
    }
    data[0] = INT32_SIZE;
  }
  var SMALLEST_UNSAFE_INTEGER, LARGEST_SAFE_INTEGER, UINT32_MAX, UINT32_SIZE, INT32_SIZE, INT32_MAX, UINT21_SIZE, UINT21_MAX, DEFAULT_STRING_POOL, LOWER_HEX_POOL, lowerHex, upperHex, sliceArray, stringRepeat, nativeMath, I32Array, imul, ARRAY_SIZE, ARRAY_MAX, M, ARRAY_SIZE_MINUS_M, A, MersenneTwister19937;
  var init_random_js_esm = __esm({
    "node_modules/random-js/dist/random-js.esm.js"() {
      SMALLEST_UNSAFE_INTEGER = 9007199254740992;
      LARGEST_SAFE_INTEGER = SMALLEST_UNSAFE_INTEGER - 1;
      UINT32_MAX = -1 >>> 0;
      UINT32_SIZE = UINT32_MAX + 1;
      INT32_SIZE = UINT32_SIZE / 2;
      INT32_MAX = INT32_SIZE - 1;
      UINT21_SIZE = 1 << 21;
      UINT21_MAX = UINT21_SIZE - 1;
      DEFAULT_STRING_POOL = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
      LOWER_HEX_POOL = "0123456789abcdef";
      lowerHex = string(LOWER_HEX_POOL);
      upperHex = string(LOWER_HEX_POOL.toUpperCase());
      sliceArray = Array.prototype.slice;
      stringRepeat = (() => {
        try {
          if ("x".repeat(3) === "xxx") {
            return (pattern, count) => pattern.repeat(count);
          }
        } catch (_) {
        }
        return (pattern, count) => {
          let result = "";
          while (count > 0) {
            if (count & 1) {
              result += pattern;
            }
            count >>= 1;
            pattern += pattern;
          }
          return result;
        };
      })();
      nativeMath = {
        next() {
          return Math.random() * UINT32_SIZE | 0;
        }
      };
      I32Array = (() => {
        try {
          const buffer = new ArrayBuffer(4);
          const view = new Int32Array(buffer);
          view[0] = INT32_SIZE;
          if (view[0] === -INT32_SIZE) {
            return Int32Array;
          }
        } catch (_) {
        }
        return Array;
      })();
      imul = (() => {
        try {
          if (Math.imul(UINT32_MAX, 5) === -5) {
            return Math.imul;
          }
        } catch (_) {
        }
        const UINT16_MAX = 65535;
        return (a, b) => {
          const ah = a >>> 16 & UINT16_MAX;
          const al = a & UINT16_MAX;
          const bh = b >>> 16 & UINT16_MAX;
          const bl = b & UINT16_MAX;
          return al * bl + (ah * bl + al * bh << 16 >>> 0) | 0;
        };
      })();
      ARRAY_SIZE = 624;
      ARRAY_MAX = ARRAY_SIZE - 1;
      M = 397;
      ARRAY_SIZE_MINUS_M = ARRAY_SIZE - M;
      A = 2567483615;
      MersenneTwister19937 = class _MersenneTwister19937 {
        /**
         * MersenneTwister19937 should not be instantiated directly.
         * Instead, use the static methods `seed`, `seedWithArray`, or `autoSeed`.
         */
        constructor() {
          this.data = new I32Array(ARRAY_SIZE);
          this.index = 0;
          this.uses = 0;
        }
        /**
         * Returns a MersenneTwister19937 seeded with an initial int32 value
         * @param initial the initial seed value
         */
        static seed(initial) {
          return new _MersenneTwister19937().seed(initial);
        }
        /**
         * Returns a MersenneTwister19937 seeded with zero or more int32 values
         * @param source A series of int32 values
         */
        static seedWithArray(source) {
          return new _MersenneTwister19937().seedWithArray(source);
        }
        /**
         * Returns a MersenneTwister19937 seeded with the current time and
         * a series of natively-generated random values
         */
        static autoSeed() {
          return _MersenneTwister19937.seedWithArray(createEntropy());
        }
        /**
         * Returns the next int32 value of the sequence
         */
        next() {
          if ((this.index | 0) >= ARRAY_SIZE) {
            refreshData(this.data);
            this.index = 0;
          }
          const value = this.data[this.index];
          this.index = this.index + 1 | 0;
          this.uses += 1;
          return temper(value) | 0;
        }
        /**
         * Returns the number of times that the Engine has been used.
         *
         * This can be provided to an unused MersenneTwister19937 with the same
         * seed, bringing it to the exact point that was left off.
         */
        getUseCount() {
          return this.uses;
        }
        /**
         * Discards one or more items from the engine
         * @param count The count of items to discard
         */
        discard(count) {
          if (count <= 0) {
            return this;
          }
          this.uses += count;
          if ((this.index | 0) >= ARRAY_SIZE) {
            refreshData(this.data);
            this.index = 0;
          }
          while (count + this.index > ARRAY_SIZE) {
            count -= ARRAY_SIZE - this.index;
            refreshData(this.data);
            this.index = 0;
          }
          this.index = this.index + count | 0;
          return this;
        }
        seed(initial) {
          let previous = 0;
          this.data[0] = previous = initial | 0;
          for (let i = 1; i < ARRAY_SIZE; i = i + 1 | 0) {
            this.data[i] = previous = imul(previous ^ previous >>> 30, 1812433253) + i | 0;
          }
          this.index = ARRAY_SIZE;
          this.uses = 0;
          return this;
        }
        seedWithArray(source) {
          this.seed(19650218);
          seedWithArray(this.data, source);
          return this;
        }
      };
    }
  });

  // node_modules/ml-random-forest/src/utils.js
  function checkFloat(n) {
    return n > 0 && n <= 1;
  }
  function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
  }
  function examplesBaggingWithReplacement(trainingSet, trainingValue, seed) {
    let engine;
    let distribution = integer(0, trainingSet.rows - 1);
    if (seed === void 0) {
      engine = MersenneTwister19937.autoSeed();
    } else if (Number.isInteger(seed)) {
      engine = MersenneTwister19937.seed(seed);
    } else {
      throw new RangeError(
        `Expected seed must be undefined or integer not ${seed}`
      );
    }
    let Xr = new Array(trainingSet.rows);
    let yr = new Array(trainingSet.rows);
    let oob = new Array(trainingSet.rows).fill(0);
    let oobN = trainingSet.rows;
    for (let i = 0; i < trainingSet.rows; ++i) {
      let index = distribution(engine);
      Xr[i] = trainingSet.getRow(index);
      yr[i] = trainingValue[index];
      if (oob[index]++ === 0) {
        oobN--;
      }
    }
    let Xoob = new Array(oobN);
    let ioob = new Array(oobN);
    for (let i = trainingSet.rows - 1; i >= 0 && oobN > 0; --i) {
      if (oob[i] === 0) {
        Xoob[--oobN] = trainingSet.getRow(i);
        ioob[oobN] = i;
      }
    }
    return {
      X: new Matrix2(Xr),
      y: yr,
      Xoob: new Matrix2(Xoob),
      ioob,
      seed: engine.next()
    };
  }
  function featureBagging(trainingSet, n, replacement, seed) {
    if (trainingSet.columns < n) {
      throw new RangeError(
        "N should be less or equal to the number of columns of X"
      );
    }
    let distribution = integer(0, trainingSet.columns - 1);
    let engine;
    if (seed === void 0) {
      engine = MersenneTwister19937.autoSeed();
    } else if (Number.isInteger(seed)) {
      engine = MersenneTwister19937.seed(seed);
    } else {
      throw new RangeError(
        `Expected seed must be undefined or integer not ${seed}`
      );
    }
    let toRet = new Matrix2(trainingSet.rows, n);
    let usedIndex;
    let index;
    if (replacement) {
      usedIndex = new Array(n);
      for (let i = 0; i < n; ++i) {
        index = distribution(engine);
        usedIndex[i] = index;
        toRet.setColumn(i, trainingSet.getColumn(index));
      }
    } else {
      usedIndex = /* @__PURE__ */ new Set();
      index = distribution(engine);
      for (let i = 0; i < n; ++i) {
        while (usedIndex.has(index)) {
          index = distribution(engine);
        }
        toRet.setColumn(i, trainingSet.getColumn(index));
        usedIndex.add(index);
      }
      usedIndex = Array.from(usedIndex);
    }
    return {
      X: toRet,
      usedIndex,
      seed: engine.next()
    };
  }
  var collectOOB;
  var init_utils2 = __esm({
    "node_modules/ml-random-forest/src/utils.js"() {
      init_matrix();
      init_random_js_esm();
      collectOOB = (oob, y, aggregate) => {
        const res = Array(y.length);
        for (let i = 0; i < y.length; i++) {
          const all = [];
          for (let j = 0; j < oob.length; j++) {
            const o = oob[j];
            if (o.index[0] === i) {
              all.push(o.predicted[0]);
              o.index = o.index.slice(1);
              o.predicted = o.predicted.slice(1);
            }
          }
          res[i] = { true: y[i], all, predicted: aggregate(all) };
        }
        return res;
      };
    }
  });

  // node_modules/ml-random-forest/src/RandomForestBase.js
  var RandomForestBase;
  var init_RandomForestBase = __esm({
    "node_modules/ml-random-forest/src/RandomForestBase.js"() {
      init_src();
      init_matrix();
      init_utils2();
      RandomForestBase = class {
        /**
         * Create a new base random forest for a classifier or regression model.
         * @constructor
         * @param {object} options
         * @param {number|String} [options.maxFeatures] - the number of features used on each estimator.
         *        * if is an integer it selects maxFeatures elements over the sample features.
         *        * if is a float between (0, 1), it takes the percentage of features.
         * @param {boolean} [options.replacement] - use replacement over the sample features.
         * @param {number} [options.seed] - seed for feature and samples selection, must be a 32-bit integer.
         * @param {number} [options.nEstimators] - number of estimator to use.
         * @param {object} [options.treeOptions] - options for the tree classifier, see [ml-cart]{@link https://mljs.github.io/decision-tree-cart/}
         * @param {boolean} [options.isClassifier] - boolean to check if is a classifier or regression model (used by subclasses).
         * @param {boolean} [options.useSampleBagging] - use bagging over training samples.
         * @param {boolean} [options.noOOB] - don't calculate Out-Of-Bag predictions.
         * @param {object} model - for load purposes.
         */
        constructor(options, model) {
          if (options === true) {
            this.replacement = model.replacement;
            this.maxFeatures = model.maxFeatures;
            this.nEstimators = model.nEstimators;
            this.treeOptions = model.treeOptions;
            this.isClassifier = model.isClassifier;
            this.seed = model.seed;
            this.n = model.n;
            this.indexes = model.indexes;
            this.useSampleBagging = model.useSampleBagging;
            this.noOOB = true;
            this.maxSamples = model.maxSamples;
            let Estimator = this.isClassifier ? DecisionTreeClassifier : DecisionTreeRegression;
            this.estimators = model.estimators.map((est) => Estimator.load(est));
          } else {
            this.replacement = options.replacement;
            this.maxFeatures = options.maxFeatures;
            this.nEstimators = options.nEstimators;
            this.treeOptions = options.treeOptions;
            this.isClassifier = options.isClassifier;
            this.seed = options.seed;
            this.useSampleBagging = options.useSampleBagging;
            this.noOOB = options.noOOB;
            this.maxSamples = options.maxSamples;
          }
        }
        /**
         * Train the decision tree with the given training set and labels.
         * @param {Matrix|Array} trainingSet
         * @param {Array} trainingValues
         */
        train(trainingSet, trainingValues) {
          let currentSeed = this.seed;
          trainingSet = Matrix2.checkMatrix(trainingSet);
          this.maxFeatures = this.maxFeatures || trainingSet.columns;
          this.numberFeatures = trainingSet.columns;
          this.numberSamples = trainingSet.rows;
          if (checkFloat(this.maxFeatures)) {
            this.n = Math.floor(trainingSet.columns * this.maxFeatures);
          } else if (Number.isInteger(this.maxFeatures)) {
            if (this.maxFeatures > trainingSet.columns) {
              throw new RangeError(
                `The maxFeatures parameter should be less than ${trainingSet.columns}`
              );
            } else {
              this.n = this.maxFeatures;
            }
          } else {
            throw new RangeError(
              `Cannot process the maxFeatures parameter ${this.maxFeatures}`
            );
          }
          if (this.maxSamples) {
            if (this.maxSamples < 0) {
              throw new RangeError(`Please choose a positive value for maxSamples`);
            } else {
              if (isFloat(this.maxSamples)) {
                if (this.maxSamples > 1) {
                  throw new RangeError(
                    "Please choose either a float value between 0 and 1 or a positive integer for maxSamples"
                  );
                } else {
                  this.numberSamples = Math.floor(trainingSet.rows * this.maxSamples);
                }
              } else if (Number.isInteger(this.maxSamples)) {
                if (this.maxSamples > trainingSet.rows) {
                  throw new RangeError(
                    `The maxSamples parameter should be less than ${trainingSet.rows}`
                  );
                } else {
                  this.numberSamples = this.maxSamples;
                }
              }
            }
          }
          if (this.maxSamples) {
            if (trainingSet.rows !== this.numberSamples) {
              let tmp = new Matrix2(this.numberSamples, trainingSet.columns);
              for (let j = 0; j < this.numberSamples; j++) {
                tmp.removeRow(0);
              }
              for (let i = 0; i < this.numberSamples; i++) {
                tmp.addRow(trainingSet.getRow(i));
              }
              trainingSet = tmp;
              trainingValues = trainingValues.slice(0, this.numberSamples);
            }
          }
          let Estimator;
          if (this.isClassifier) {
            Estimator = DecisionTreeClassifier;
          } else {
            Estimator = DecisionTreeRegression;
          }
          this.estimators = new Array(this.nEstimators);
          this.indexes = new Array(this.nEstimators);
          let oobResults = new Array(this.nEstimators);
          for (let i = 0; i < this.nEstimators; ++i) {
            let res = this.useSampleBagging ? examplesBaggingWithReplacement(
              trainingSet,
              trainingValues,
              currentSeed
            ) : {
              X: trainingSet,
              y: trainingValues,
              seed: currentSeed,
              Xoob: void 0,
              yoob: [],
              ioob: []
            };
            let X = res.X;
            let y = res.y;
            currentSeed = res.seed;
            let { Xoob, ioob } = res;
            res = featureBagging(X, this.n, this.replacement, currentSeed);
            X = res.X;
            currentSeed = res.seed;
            this.indexes[i] = res.usedIndex;
            this.estimators[i] = new Estimator(this.treeOptions);
            this.estimators[i].train(X, y);
            if (!this.noOOB && this.useSampleBagging) {
              let xoob = new MatrixColumnSelectionView2(Xoob, this.indexes[i]);
              oobResults[i] = {
                index: ioob,
                predicted: this.estimators[i].predict(xoob)
              };
            }
          }
          if (!this.noOOB && this.useSampleBagging && oobResults.length > 0) {
            this.oobResults = collectOOB(
              oobResults,
              trainingValues,
              this.selection.bind(this)
            );
          }
        }
        /**
         * Evaluate the feature importances for each tree in the ensemble
         * @return {Array} feature importances
         */
        featureImportance() {
          const trees = JSON.parse(JSON.stringify(this.estimators));
          const indexes = JSON.parse(JSON.stringify(this.indexes));
          let importance = [];
          function computeFeatureImportances(i, node) {
            if (!node || !("splitColumn" in node) || !(node.gain > 0)) return;
            let f = node.gain * node.numberSamples;
            if ("left" in node) {
              f -= (node.left.gain || 0) * (node.left.numberSamples || 0);
            }
            if ("right" in node) {
              f -= (node.right.gain || 0) * (node.right.numberSamples || 0);
            }
            importance[i][node.splitColumn] += f;
            if (node.left) {
              computeFeatureImportances(i, node.left);
            }
            if (node.right) {
              computeFeatureImportances(i, node.right);
            }
          }
          function normalizeImportances(i) {
            const s2 = importance[i].reduce((cum, v) => {
              return cum += v;
            }, 0);
            importance[i] = importance[i].map((v) => {
              return v / s2;
            });
          }
          for (let i = 0; i < trees.length; i++) {
            importance.push(new Array(this.numberFeatures).fill(0));
            computeFeatureImportances(i, trees[i].root);
            normalizeImportances(i);
          }
          let avgImportance = new Array(this.numberFeatures).fill(0);
          for (let i = 0; i < importance.length; i++) {
            for (let x = 0; x < this.numberFeatures; x++) {
              avgImportance[indexes[i][x]] += importance[i][x];
            }
          }
          const s = avgImportance.reduce((cum, v) => {
            return cum += v;
          }, 0);
          return avgImportance.map((v) => {
            return v / s;
          });
        }
        /**
         * Method that returns the way the algorithm generates the predictions, for example, in classification
         * you can return the mode of all predictions retrieved by the trees, or in case of regression you can
         * use the mean or the median.
         * @abstract
         * @param {Array} values - predictions of the estimators.
         * @return {number} prediction.
         */
        // eslint-disable-next-line no-unused-vars
        selection(values) {
          throw new Error("Abstract method 'selection' not implemented!");
        }
        /**
         * Predicts the output given the matrix to predict.
         * @param {Matrix|Array} toPredict
         * @return {Array} predictions
         */
        predict(toPredict) {
          const predictionValues = this.predictionValues(toPredict);
          let predictions = new Array(predictionValues.rows);
          for (let i = 0; i < predictionValues.rows; ++i) {
            predictions[i] = this.selection(predictionValues.getRow(i));
          }
          return predictions;
        }
        /**
         * Predicts the output given the matrix to predict.
         * @param {Matrix|Array} toPredict
         * @return {MatrixTransposeView} predictions of estimators
         */
        predictionValues(toPredict) {
          let predictionValues = new Array(this.nEstimators);
          toPredict = Matrix2.checkMatrix(toPredict);
          for (let i = 0; i < this.nEstimators; ++i) {
            let X = new MatrixColumnSelectionView2(toPredict, this.indexes[i]);
            predictionValues[i] = this.estimators[i].predict(X);
          }
          return predictionValues = new MatrixTransposeView2(
            new WrapperMatrix2D2(predictionValues)
          );
        }
        /**
         * Returns the Out-Of-Bag predictions.
         * @return {Array} predictions
         */
        predictOOB() {
          if (!this.oobResults || this.oobResults.length === 0) {
            throw new Error(
              "No Out-Of-Bag results found. Did you forgot to train first?"
            );
          }
          return this.oobResults.map((v) => v.predicted);
        }
        /**
         * Export the current model to JSON.
         * @return {object} - Current model.
         */
        toJSON() {
          return {
            indexes: this.indexes,
            n: this.n,
            replacement: this.replacement,
            maxFeatures: this.maxFeatures,
            nEstimators: this.nEstimators,
            treeOptions: this.treeOptions,
            isClassifier: this.isClassifier,
            seed: this.seed,
            estimators: this.estimators.map((est) => est.toJSON()),
            useSampleBagging: this.useSampleBagging
          };
        }
      };
    }
  });

  // node_modules/ml-random-forest/src/RandomForestClassifier.js
  var defaultOptions3, RandomForestClassifier;
  var init_RandomForestClassifier = __esm({
    "node_modules/ml-random-forest/src/RandomForestClassifier.js"() {
      init_lib_es63();
      init_RandomForestBase();
      defaultOptions3 = {
        maxFeatures: 1,
        replacement: true,
        nEstimators: 50,
        seed: 42,
        useSampleBagging: true,
        noOOB: false
      };
      RandomForestClassifier = class _RandomForestClassifier extends RandomForestBase {
        /**
         * Create a new base random forest for a classifier or regression model.
         * @constructor
         * @param {object} options
         * @param {number} [options.maxFeatures=1.0] - the number of features used on each estimator.
         *        * if is an integer it selects maxFeatures elements over the sample features.
         *        * if is a float between (0, 1), it takes the percentage of features.
         * @param {boolean} [options.replacement=true] - use replacement over the sample features.
         * @param {number} [options.seed=42] - seed for feature and samples selection, must be a 32-bit integer.
         * @param {number} [options.nEstimators=50] - number of estimator to use.
         * @param {object} [options.treeOptions={}] - options for the tree classifier, see [ml-cart]{@link https://mljs.github.io/decision-tree-cart/}
         * @param {boolean} [options.useSampleBagging=true] - use bagging over training samples.
         * @param {number} [options.maxSamples=null] - if null, then draw X.shape[0] samples. If int, then draw maxSamples samples. If float, then draw maxSamples * X.shape[0] samples. Thus, maxSamples should be in the interval (0.0, 1.0].
         * @param {object} model - for load purposes.
         */
        constructor(options, model) {
          if (options === true) {
            super(true, model.baseModel);
          } else {
            options = Object.assign({}, defaultOptions3, options);
            options.isClassifier = true;
            super(options);
          }
        }
        /**
         * retrieve the prediction given the selection method.
         * @param {Array} values - predictions of the estimators.
         * @return {number} prediction
         */
        selection(values) {
          return mode(values);
        }
        /**
         * Export the current model to JSON.
         * @return {object} - Current model.
         */
        toJSON() {
          let baseModel = super.toJSON();
          return {
            baseModel,
            name: "RFClassifier"
          };
        }
        /**
         * Returns the confusion matrix
         * Make sure to run train first.
         * @return {object} - Current model.
         */
        getConfusionMatrix() {
          if (!this.oobResults) {
            throw new Error("No Out-Of-Bag results available.");
          }
          const labels = /* @__PURE__ */ new Set();
          const matrix2 = this.oobResults.reduce((p, v) => {
            labels.add(v.true);
            labels.add(v.predicted);
            const x = p[v.predicted] || {};
            x[v.true] = (x[v.true] || 0) + 1;
            p[v.predicted] = x;
            return p;
          }, {});
          const sortedLabels = [...labels].sort();
          return sortedLabels.map(
            (v) => sortedLabels.map((w) => (matrix2[v] || {})[w] || 0)
          );
        }
        /**
         * Load a Decision tree classifier with the given model.
         * @param {object} model
         * @return {RandomForestClassifier}
         */
        static load(model) {
          if (model.name !== "RFClassifier") {
            throw new RangeError(`Invalid model: ${model.name}`);
          }
          return new _RandomForestClassifier(true, model);
        }
        /**
         * Predicts the probability of a label given the matrix to predict.
         * @param {Matrix|Array} toPredict
         * @param {number} label
         * @return {Array} predictions
         */
        predictProbability(toPredict, label) {
          const predictionValues = this.predictionValues(toPredict);
          let predictions = new Array(predictionValues.rows);
          for (let i = 0; i < predictionValues.rows; ++i) {
            const pvs = predictionValues.getRow(i);
            const l = pvs.length;
            const roundFactor = Math.pow(10, 6);
            predictions[i] = Math.round(
              pvs.reduce((p, v) => {
                if (v === label) {
                  p += roundFactor / l;
                }
                return p;
              })
            ) / roundFactor;
          }
          return predictions;
        }
      };
    }
  });

  // node_modules/median-quickselect/lib/median-quickselect.min.js
  var require_median_quickselect_min = __commonJS({
    "node_modules/median-quickselect/lib/median-quickselect.min.js"(exports, module) {
      (function() {
        function a(d) {
          for (var e = 0, f = d.length - 1, g = void 0, h = void 0, i = void 0, j = c(e, f); true; ) {
            if (f <= e) return d[j];
            if (f == e + 1) return d[e] > d[f] && b(d, e, f), d[j];
            for (g = c(e, f), d[g] > d[f] && b(d, g, f), d[e] > d[f] && b(d, e, f), d[g] > d[e] && b(d, g, e), b(d, g, e + 1), h = e + 1, i = f; true; ) {
              do
                h++;
              while (d[e] > d[h]);
              do
                i--;
              while (d[i] > d[e]);
              if (i < h) break;
              b(d, h, i);
            }
            b(d, e, i), i <= j && (e = h), i >= j && (f = i - 1);
          }
        }
        var b = function b2(d, e, f) {
          var _ref;
          return _ref = [d[f], d[e]], d[e] = _ref[0], d[f] = _ref[1], _ref;
        }, c = function c2(d, e) {
          return ~~((d + e) / 2);
        };
        "undefined" != typeof module && module.exports ? module.exports = a : window.median = a;
      })();
    }
  });

  // node_modules/ml-array-median/lib-es6/index.js
  function median(input) {
    if (!(0, import_is_any_array3.isAnyArray)(input)) {
      throw new TypeError("input must be an array");
    }
    if (input.length === 0) {
      throw new TypeError("input must not be empty");
    }
    return (0, import_median_quickselect.default)(input.slice());
  }
  var import_is_any_array3, import_median_quickselect;
  var init_lib_es64 = __esm({
    "node_modules/ml-array-median/lib-es6/index.js"() {
      import_is_any_array3 = __toESM(require_lib());
      import_median_quickselect = __toESM(require_median_quickselect_min());
    }
  });

  // node_modules/ml-random-forest/src/RandomForestRegression.js
  var selectionMethods, defaultOptions4, RandomForestRegression;
  var init_RandomForestRegression = __esm({
    "node_modules/ml-random-forest/src/RandomForestRegression.js"() {
      init_lib_es62();
      init_lib_es64();
      init_RandomForestBase();
      selectionMethods = {
        mean,
        median
      };
      defaultOptions4 = {
        maxFeatures: 1,
        replacement: false,
        nEstimators: 50,
        treeOptions: {},
        selectionMethod: "mean",
        seed: 42,
        useSampleBagging: true,
        noOOB: false
      };
      RandomForestRegression = class _RandomForestRegression extends RandomForestBase {
        /**
         * Create a new base random forest for a classifier or regression model.
         * @constructor
         * @param {object} options
         * @param {number} [options.maxFeatures=1.0] - the number of features used on each estimator.
         *        * if is an integer it selects maxFeatures elements over the sample features.
         *        * if is a float between (0, 1), it takes the percentage of features.
         * @param {boolean} [options.replacement=true] - use replacement over the sample features.
         * @param {number} [options.seed=42] - seed for feature and samples selection, must be a 32-bit integer.
         * @param {number} [options.nEstimators=50] - number of estimator to use.
         * @param {object} [options.treeOptions={}] - options for the tree classifier, see [ml-cart]{@link https://mljs.github.io/decision-tree-cart/}
         * @param {string} [options.selectionMethod="mean"] - the way to calculate the prediction from estimators, "mean" and "median" are supported.
         * @param {boolean} [options.useSampleBagging=true] - use bagging over training samples.
         * @param {number} [options.maxSamples=null] - if null, then draw X.shape[0] samples. If int, then draw maxSamples samples. If float, then draw maxSamples * X.shape[0] samples. Thus, maxSamples should be in the interval (0.0, 1.0].
         * @param {object} model - for load purposes.
         */
        constructor(options, model) {
          if (options === true) {
            super(true, model.baseModel);
            this.selectionMethod = model.selectionMethod;
          } else {
            options = Object.assign({}, defaultOptions4, options);
            if (!(options.selectionMethod === "mean" || options.selectionMethod === "median")) {
              throw new RangeError(
                `Unsupported selection method ${options.selectionMethod}`
              );
            }
            options.isClassifier = false;
            super(options);
            this.selectionMethod = options.selectionMethod;
          }
        }
        /**
         * retrieve the prediction given the selection method.
         * @param {Array} values - predictions of the estimators.
         * @return {number} prediction
         */
        selection(values) {
          return selectionMethods[this.selectionMethod](values);
        }
        /**
         * Export the current model to JSON.
         * @return {object} - Current model.
         */
        toJSON() {
          let baseModel = super.toJSON();
          return {
            baseModel,
            selectionMethod: this.selectionMethod,
            name: "RFRegression"
          };
        }
        /**
         * Load a Decision tree classifier with the given model.
         * @param {object} model
         * @return {RandomForestRegression}
         */
        static load(model) {
          if (model.name !== "RFRegression") {
            throw new RangeError(`Invalid model: ${model.name}`);
          }
          return new _RandomForestRegression(true, model);
        }
      };
    }
  });

  // node_modules/ml-random-forest/src/index.js
  var init_src2 = __esm({
    "node_modules/ml-random-forest/src/index.js"() {
      init_RandomForestClassifier();
      init_RandomForestRegression();
    }
  });

  // node_modules/ml-distance-euclidean/lib/euclidean.js
  var require_euclidean = __commonJS({
    "node_modules/ml-distance-euclidean/lib/euclidean.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      function squaredEuclidean(p, q) {
        let d = 0;
        for (let i = 0; i < p.length; i++) {
          d += (p[i] - q[i]) * (p[i] - q[i]);
        }
        return d;
      }
      exports.squaredEuclidean = squaredEuclidean;
      function euclidean(p, q) {
        return Math.sqrt(squaredEuclidean(p, q));
      }
      exports.euclidean = euclidean;
    }
  });

  // node_modules/ml-knn/src/KDTree.js
  function Node(obj, dimension, parent) {
    this.obj = obj;
    this.left = null;
    this.right = null;
    this.parent = parent;
    this.dimension = dimension;
  }
  function toJSONImpl(src) {
    const dest = new Node(src.obj, src.dimension, null);
    if (src.left) dest.left = toJSONImpl(src.left);
    if (src.right) dest.right = toJSONImpl(src.right);
    return dest;
  }
  function buildTree(points, depth, parent, dimensions) {
    const dim = depth % dimensions.length;
    if (points.length === 0) {
      return null;
    }
    if (points.length === 1) {
      return new Node(points[0], dim, parent);
    }
    points.sort((a, b) => a[dimensions[dim]] - b[dimensions[dim]]);
    const median2 = Math.floor(points.length / 2);
    const node = new Node(points[median2], dim, parent);
    node.left = buildTree(points.slice(0, median2), depth + 1, node, dimensions);
    node.right = buildTree(points.slice(median2 + 1), depth + 1, node, dimensions);
    return node;
  }
  function restoreParent(root) {
    if (root.left) {
      root.left.parent = root;
      restoreParent(root.left);
    }
    if (root.right) {
      root.right.parent = root;
      restoreParent(root.right);
    }
  }
  var KDTree, BinaryHeap;
  var init_KDTree = __esm({
    "node_modules/ml-knn/src/KDTree.js"() {
      KDTree = class {
        constructor(points, metric) {
          if (!Array.isArray(points)) {
            this.dimensions = points.dimensions;
            this.root = points;
            restoreParent(this.root);
          } else {
            this.dimensions = new Array(points[0].length);
            for (var i = 0; i < this.dimensions.length; i++) {
              this.dimensions[i] = i;
            }
            this.root = buildTree(points, 0, null, this.dimensions);
          }
          this.metric = metric;
        }
        // Convert to a JSON serializable structure; this just requires removing
        // the `parent` property
        toJSON() {
          const result = toJSONImpl(this.root, true);
          result.dimensions = this.dimensions;
          return result;
        }
        nearest(point, maxNodes, maxDistance) {
          const metric = this.metric;
          const dimensions = this.dimensions;
          var i;
          const bestNodes = new BinaryHeap(function(e) {
            return -e[1];
          });
          function nearestSearch(node) {
            const dimension = dimensions[node.dimension];
            const ownDistance = metric(point, node.obj);
            const linearPoint = {};
            var bestChild, linearDistance, otherChild, i2;
            function saveNode(node2, distance) {
              bestNodes.push([node2, distance]);
              if (bestNodes.size() > maxNodes) {
                bestNodes.pop();
              }
            }
            for (i2 = 0; i2 < dimensions.length; i2 += 1) {
              if (i2 === node.dimension) {
                linearPoint[dimensions[i2]] = point[dimensions[i2]];
              } else {
                linearPoint[dimensions[i2]] = node.obj[dimensions[i2]];
              }
            }
            linearDistance = metric(linearPoint, node.obj);
            if (node.right === null && node.left === null) {
              if (bestNodes.size() < maxNodes || ownDistance < bestNodes.peek()[1]) {
                saveNode(node, ownDistance);
              }
              return;
            }
            if (node.right === null) {
              bestChild = node.left;
            } else if (node.left === null) {
              bestChild = node.right;
            } else {
              if (point[dimension] < node.obj[dimension]) {
                bestChild = node.left;
              } else {
                bestChild = node.right;
              }
            }
            nearestSearch(bestChild);
            if (bestNodes.size() < maxNodes || ownDistance < bestNodes.peek()[1]) {
              saveNode(node, ownDistance);
            }
            if (bestNodes.size() < maxNodes || Math.abs(linearDistance) < bestNodes.peek()[1]) {
              if (bestChild === node.left) {
                otherChild = node.right;
              } else {
                otherChild = node.left;
              }
              if (otherChild !== null) {
                nearestSearch(otherChild);
              }
            }
          }
          if (maxDistance) {
            for (i = 0; i < maxNodes; i += 1) {
              bestNodes.push([null, maxDistance]);
            }
          }
          if (this.root) {
            nearestSearch(this.root);
          }
          const result = [];
          for (i = 0; i < Math.min(maxNodes, bestNodes.content.length); i += 1) {
            if (bestNodes.content[i][0]) {
              result.push([bestNodes.content[i][0].obj, bestNodes.content[i][1]]);
            }
          }
          return result;
        }
      };
      BinaryHeap = class {
        constructor(scoreFunction) {
          this.content = [];
          this.scoreFunction = scoreFunction;
        }
        push(element) {
          this.content.push(element);
          this.bubbleUp(this.content.length - 1);
        }
        pop() {
          var result = this.content[0];
          var end = this.content.pop();
          if (this.content.length > 0) {
            this.content[0] = end;
            this.sinkDown(0);
          }
          return result;
        }
        peek() {
          return this.content[0];
        }
        size() {
          return this.content.length;
        }
        bubbleUp(n) {
          var element = this.content[n];
          while (n > 0) {
            const parentN = Math.floor((n + 1) / 2) - 1;
            const parent = this.content[parentN];
            if (this.scoreFunction(element) < this.scoreFunction(parent)) {
              this.content[parentN] = element;
              this.content[n] = parent;
              n = parentN;
            } else {
              break;
            }
          }
        }
        sinkDown(n) {
          var length = this.content.length;
          var element = this.content[n];
          var elemScore = this.scoreFunction(element);
          while (true) {
            var child2N = (n + 1) * 2;
            var child1N = child2N - 1;
            var swap = null;
            if (child1N < length) {
              var child1 = this.content[child1N];
              var child1Score = this.scoreFunction(child1);
              if (child1Score < elemScore) {
                swap = child1N;
              }
            }
            if (child2N < length) {
              var child2 = this.content[child2N];
              var child2Score = this.scoreFunction(child2);
              if (child2Score < (swap === null ? elemScore : child1Score)) {
                swap = child2N;
              }
            }
            if (swap !== null) {
              this.content[n] = this.content[swap];
              this.content[swap] = element;
              n = swap;
            } else {
              break;
            }
          }
        }
      };
    }
  });

  // node_modules/ml-knn/src/index.js
  function getSinglePrediction(knn, currentCase) {
    var nearestPoints = knn.kdTree.nearest(currentCase, knn.k);
    var pointsPerClass = {};
    var predictedClass = -1;
    var maxPoints = -1;
    var lastElement = nearestPoints[0][0].length - 1;
    for (var element of knn.classes) {
      pointsPerClass[element] = 0;
    }
    for (var i = 0; i < nearestPoints.length; ++i) {
      var currentClass = nearestPoints[i][0][lastElement];
      var currentPoints = ++pointsPerClass[currentClass];
      if (currentPoints > maxPoints) {
        predictedClass = currentClass;
        maxPoints = currentPoints;
      }
    }
    return predictedClass;
  }
  var import_ml_distance_euclidean, KNN;
  var init_src3 = __esm({
    "node_modules/ml-knn/src/index.js"() {
      import_ml_distance_euclidean = __toESM(require_euclidean());
      init_KDTree();
      KNN = class _KNN {
        /**
         * @param {Array} dataset
         * @param {Array} labels
         * @param {object} options
         * @param {number} [options.k=numberOfClasses + 1] - Number of neighbors to classify.
         * @param {function} [options.distance=euclideanDistance] - Distance function that takes two parameters.
         */
        constructor(dataset, labels, options = {}) {
          if (dataset === true) {
            const model = labels;
            this.kdTree = new KDTree(model.kdTree, options);
            this.k = model.k;
            this.classes = new Set(model.classes);
            this.isEuclidean = model.isEuclidean;
            return;
          }
          const classes = new Set(labels);
          const { distance = import_ml_distance_euclidean.euclidean, k = classes.size + 1 } = options;
          const points = new Array(dataset.length);
          for (var i = 0; i < points.length; ++i) {
            points[i] = dataset[i].slice();
          }
          for (i = 0; i < labels.length; ++i) {
            points[i].push(labels[i]);
          }
          this.kdTree = new KDTree(points, distance);
          this.k = k;
          this.classes = classes;
          this.isEuclidean = distance === import_ml_distance_euclidean.euclidean;
        }
        /**
         * Create a new KNN instance with the given model.
         * @param {object} model
         * @param {function} distance=euclideanDistance - distance function must be provided if the model wasn't trained with euclidean distance.
         * @return {KNN}
         */
        static load(model, distance = import_ml_distance_euclidean.euclidean) {
          if (model.name !== "KNN") {
            throw new Error(`invalid model: ${model.name}`);
          }
          if (!model.isEuclidean && distance === import_ml_distance_euclidean.euclidean) {
            throw new Error(
              "a custom distance function was used to create the model. Please provide it again"
            );
          }
          if (model.isEuclidean && distance !== import_ml_distance_euclidean.euclidean) {
            throw new Error(
              "the model was created with the default distance function. Do not load it with another one"
            );
          }
          return new _KNN(true, model, distance);
        }
        /**
         * Return a JSON containing the kd-tree model.
         * @return {object} JSON KNN model.
         */
        toJSON() {
          return {
            name: "KNN",
            kdTree: this.kdTree,
            k: this.k,
            classes: Array.from(this.classes),
            isEuclidean: this.isEuclidean
          };
        }
        /**
         * Predicts the output given the matrix to predict.
         * @param {Array} dataset
         * @return {Array} predictions
         */
        predict(dataset) {
          if (Array.isArray(dataset)) {
            if (typeof dataset[0] === "number") {
              return getSinglePrediction(this, dataset);
            } else if (Array.isArray(dataset[0]) && typeof dataset[0][0] === "number") {
              const predictions = new Array(dataset.length);
              for (var i = 0; i < dataset.length; i++) {
                predictions[i] = getSinglePrediction(this, dataset[i]);
              }
              return predictions;
            }
          }
          throw new TypeError("dataset to predict must be an array or a matrix");
        }
      };
    }
  });

  // node_modules/ml-svm/node_modules/ml-matrix/matrix.js
  var require_matrix2 = __commonJS({
    "node_modules/ml-svm/node_modules/ml-matrix/matrix.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      function _interopDefault(ex) {
        return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
      }
      var rescale = _interopDefault(require_lib4());
      var max = _interopDefault(require_lib2());
      var LuDecomposition2 = class {
        constructor(matrix2) {
          matrix2 = WrapperMatrix2D3.checkMatrix(matrix2);
          var lu = matrix2.clone();
          var rows = lu.rows;
          var columns = lu.columns;
          var pivotVector = new Array(rows);
          var pivotSign = 1;
          var i, j, k, p, s, t, v;
          var LUcolj, kmax;
          for (i = 0; i < rows; i++) {
            pivotVector[i] = i;
          }
          LUcolj = new Array(rows);
          for (j = 0; j < columns; j++) {
            for (i = 0; i < rows; i++) {
              LUcolj[i] = lu.get(i, j);
            }
            for (i = 0; i < rows; i++) {
              kmax = Math.min(i, j);
              s = 0;
              for (k = 0; k < kmax; k++) {
                s += lu.get(i, k) * LUcolj[k];
              }
              LUcolj[i] -= s;
              lu.set(i, j, LUcolj[i]);
            }
            p = j;
            for (i = j + 1; i < rows; i++) {
              if (Math.abs(LUcolj[i]) > Math.abs(LUcolj[p])) {
                p = i;
              }
            }
            if (p !== j) {
              for (k = 0; k < columns; k++) {
                t = lu.get(p, k);
                lu.set(p, k, lu.get(j, k));
                lu.set(j, k, t);
              }
              v = pivotVector[p];
              pivotVector[p] = pivotVector[j];
              pivotVector[j] = v;
              pivotSign = -pivotSign;
            }
            if (j < rows && lu.get(j, j) !== 0) {
              for (i = j + 1; i < rows; i++) {
                lu.set(i, j, lu.get(i, j) / lu.get(j, j));
              }
            }
          }
          this.LU = lu;
          this.pivotVector = pivotVector;
          this.pivotSign = pivotSign;
        }
        /**
         *
         * @return {boolean}
         */
        isSingular() {
          var data = this.LU;
          var col = data.columns;
          for (var j = 0; j < col; j++) {
            if (data[j][j] === 0) {
              return true;
            }
          }
          return false;
        }
        /**
         *
         * @param {Matrix} value
         * @return {Matrix}
         */
        solve(value) {
          value = Matrix3.checkMatrix(value);
          var lu = this.LU;
          var rows = lu.rows;
          if (rows !== value.rows) {
            throw new Error("Invalid matrix dimensions");
          }
          if (this.isSingular()) {
            throw new Error("LU matrix is singular");
          }
          var count = value.columns;
          var X = value.subMatrixRow(this.pivotVector, 0, count - 1);
          var columns = lu.columns;
          var i, j, k;
          for (k = 0; k < columns; k++) {
            for (i = k + 1; i < columns; i++) {
              for (j = 0; j < count; j++) {
                X[i][j] -= X[k][j] * lu[i][k];
              }
            }
          }
          for (k = columns - 1; k >= 0; k--) {
            for (j = 0; j < count; j++) {
              X[k][j] /= lu[k][k];
            }
            for (i = 0; i < k; i++) {
              for (j = 0; j < count; j++) {
                X[i][j] -= X[k][j] * lu[i][k];
              }
            }
          }
          return X;
        }
        /**
         *
         * @return {number}
         */
        get determinant() {
          var data = this.LU;
          if (!data.isSquare()) {
            throw new Error("Matrix must be square");
          }
          var determinant2 = this.pivotSign;
          var col = data.columns;
          for (var j = 0; j < col; j++) {
            determinant2 *= data[j][j];
          }
          return determinant2;
        }
        /**
         *
         * @return {Matrix}
         */
        get lowerTriangularMatrix() {
          var data = this.LU;
          var rows = data.rows;
          var columns = data.columns;
          var X = new Matrix3(rows, columns);
          for (var i = 0; i < rows; i++) {
            for (var j = 0; j < columns; j++) {
              if (i > j) {
                X[i][j] = data[i][j];
              } else if (i === j) {
                X[i][j] = 1;
              } else {
                X[i][j] = 0;
              }
            }
          }
          return X;
        }
        /**
         *
         * @return {Matrix}
         */
        get upperTriangularMatrix() {
          var data = this.LU;
          var rows = data.rows;
          var columns = data.columns;
          var X = new Matrix3(rows, columns);
          for (var i = 0; i < rows; i++) {
            for (var j = 0; j < columns; j++) {
              if (i <= j) {
                X[i][j] = data[i][j];
              } else {
                X[i][j] = 0;
              }
            }
          }
          return X;
        }
        /**
         *
         * @return {Array<number>}
         */
        get pivotPermutationVector() {
          return this.pivotVector.slice();
        }
      };
      function hypotenuse(a, b) {
        var r = 0;
        if (Math.abs(a) > Math.abs(b)) {
          r = b / a;
          return Math.abs(a) * Math.sqrt(1 + r * r);
        }
        if (b !== 0) {
          r = a / b;
          return Math.abs(b) * Math.sqrt(1 + r * r);
        }
        return 0;
      }
      function getFilled2DArray(rows, columns, value) {
        var array = new Array(rows);
        for (var i = 0; i < rows; i++) {
          array[i] = new Array(columns);
          for (var j = 0; j < columns; j++) {
            array[i][j] = value;
          }
        }
        return array;
      }
      var SingularValueDecomposition2 = class {
        constructor(value, options = {}) {
          value = WrapperMatrix2D3.checkMatrix(value);
          var m = value.rows;
          var n = value.columns;
          const {
            computeLeftSingularVectors = true,
            computeRightSingularVectors = true,
            autoTranspose = false
          } = options;
          var wantu = Boolean(computeLeftSingularVectors);
          var wantv = Boolean(computeRightSingularVectors);
          var swapped = false;
          var a;
          if (m < n) {
            if (!autoTranspose) {
              a = value.clone();
              console.warn(
                "Computing SVD on a matrix with more columns than rows. Consider enabling autoTranspose"
              );
            } else {
              a = value.transpose();
              m = a.rows;
              n = a.columns;
              swapped = true;
              var aux = wantu;
              wantu = wantv;
              wantv = aux;
            }
          } else {
            a = value.clone();
          }
          var nu = Math.min(m, n);
          var ni = Math.min(m + 1, n);
          var s = new Array(ni);
          var U = getFilled2DArray(m, nu, 0);
          var V = getFilled2DArray(n, n, 0);
          var e = new Array(n);
          var work = new Array(m);
          var si = new Array(ni);
          for (let i = 0; i < ni; i++) si[i] = i;
          var nct = Math.min(m - 1, n);
          var nrt = Math.max(0, Math.min(n - 2, m));
          var mrc = Math.max(nct, nrt);
          for (let k = 0; k < mrc; k++) {
            if (k < nct) {
              s[k] = 0;
              for (let i = k; i < m; i++) {
                s[k] = hypotenuse(s[k], a[i][k]);
              }
              if (s[k] !== 0) {
                if (a[k][k] < 0) {
                  s[k] = -s[k];
                }
                for (let i = k; i < m; i++) {
                  a[i][k] /= s[k];
                }
                a[k][k] += 1;
              }
              s[k] = -s[k];
            }
            for (let j = k + 1; j < n; j++) {
              if (k < nct && s[k] !== 0) {
                let t = 0;
                for (let i = k; i < m; i++) {
                  t += a[i][k] * a[i][j];
                }
                t = -t / a[k][k];
                for (let i = k; i < m; i++) {
                  a[i][j] += t * a[i][k];
                }
              }
              e[j] = a[k][j];
            }
            if (wantu && k < nct) {
              for (let i = k; i < m; i++) {
                U[i][k] = a[i][k];
              }
            }
            if (k < nrt) {
              e[k] = 0;
              for (let i = k + 1; i < n; i++) {
                e[k] = hypotenuse(e[k], e[i]);
              }
              if (e[k] !== 0) {
                if (e[k + 1] < 0) {
                  e[k] = 0 - e[k];
                }
                for (let i = k + 1; i < n; i++) {
                  e[i] /= e[k];
                }
                e[k + 1] += 1;
              }
              e[k] = -e[k];
              if (k + 1 < m && e[k] !== 0) {
                for (let i = k + 1; i < m; i++) {
                  work[i] = 0;
                }
                for (let i = k + 1; i < m; i++) {
                  for (let j = k + 1; j < n; j++) {
                    work[i] += e[j] * a[i][j];
                  }
                }
                for (let j = k + 1; j < n; j++) {
                  let t = -e[j] / e[k + 1];
                  for (let i = k + 1; i < m; i++) {
                    a[i][j] += t * work[i];
                  }
                }
              }
              if (wantv) {
                for (let i = k + 1; i < n; i++) {
                  V[i][k] = e[i];
                }
              }
            }
          }
          let p = Math.min(n, m + 1);
          if (nct < n) {
            s[nct] = a[nct][nct];
          }
          if (m < p) {
            s[p - 1] = 0;
          }
          if (nrt + 1 < p) {
            e[nrt] = a[nrt][p - 1];
          }
          e[p - 1] = 0;
          if (wantu) {
            for (let j = nct; j < nu; j++) {
              for (let i = 0; i < m; i++) {
                U[i][j] = 0;
              }
              U[j][j] = 1;
            }
            for (let k = nct - 1; k >= 0; k--) {
              if (s[k] !== 0) {
                for (let j = k + 1; j < nu; j++) {
                  let t = 0;
                  for (let i = k; i < m; i++) {
                    t += U[i][k] * U[i][j];
                  }
                  t = -t / U[k][k];
                  for (let i = k; i < m; i++) {
                    U[i][j] += t * U[i][k];
                  }
                }
                for (let i = k; i < m; i++) {
                  U[i][k] = -U[i][k];
                }
                U[k][k] = 1 + U[k][k];
                for (let i = 0; i < k - 1; i++) {
                  U[i][k] = 0;
                }
              } else {
                for (let i = 0; i < m; i++) {
                  U[i][k] = 0;
                }
                U[k][k] = 1;
              }
            }
          }
          if (wantv) {
            for (let k = n - 1; k >= 0; k--) {
              if (k < nrt && e[k] !== 0) {
                for (let j = k + 1; j < n; j++) {
                  let t = 0;
                  for (let i = k + 1; i < n; i++) {
                    t += V[i][k] * V[i][j];
                  }
                  t = -t / V[k + 1][k];
                  for (let i = k + 1; i < n; i++) {
                    V[i][j] += t * V[i][k];
                  }
                }
              }
              for (let i = 0; i < n; i++) {
                V[i][k] = 0;
              }
              V[k][k] = 1;
            }
          }
          var pp = p - 1;
          var eps = Number.EPSILON;
          while (p > 0) {
            let k, kase;
            for (k = p - 2; k >= -1; k--) {
              if (k === -1) {
                break;
              }
              const alpha = Number.MIN_VALUE + eps * Math.abs(s[k] + Math.abs(s[k + 1]));
              if (Math.abs(e[k]) <= alpha || Number.isNaN(e[k])) {
                e[k] = 0;
                break;
              }
            }
            if (k === p - 2) {
              kase = 4;
            } else {
              let ks;
              for (ks = p - 1; ks >= k; ks--) {
                if (ks === k) {
                  break;
                }
                let t = (ks !== p ? Math.abs(e[ks]) : 0) + (ks !== k + 1 ? Math.abs(e[ks - 1]) : 0);
                if (Math.abs(s[ks]) <= eps * t) {
                  s[ks] = 0;
                  break;
                }
              }
              if (ks === k) {
                kase = 3;
              } else if (ks === p - 1) {
                kase = 1;
              } else {
                kase = 2;
                k = ks;
              }
            }
            k++;
            switch (kase) {
              case 1: {
                let f = e[p - 2];
                e[p - 2] = 0;
                for (let j = p - 2; j >= k; j--) {
                  let t = hypotenuse(s[j], f);
                  let cs = s[j] / t;
                  let sn = f / t;
                  s[j] = t;
                  if (j !== k) {
                    f = -sn * e[j - 1];
                    e[j - 1] = cs * e[j - 1];
                  }
                  if (wantv) {
                    for (let i = 0; i < n; i++) {
                      t = cs * V[i][j] + sn * V[i][p - 1];
                      V[i][p - 1] = -sn * V[i][j] + cs * V[i][p - 1];
                      V[i][j] = t;
                    }
                  }
                }
                break;
              }
              case 2: {
                let f = e[k - 1];
                e[k - 1] = 0;
                for (let j = k; j < p; j++) {
                  let t = hypotenuse(s[j], f);
                  let cs = s[j] / t;
                  let sn = f / t;
                  s[j] = t;
                  f = -sn * e[j];
                  e[j] = cs * e[j];
                  if (wantu) {
                    for (let i = 0; i < m; i++) {
                      t = cs * U[i][j] + sn * U[i][k - 1];
                      U[i][k - 1] = -sn * U[i][j] + cs * U[i][k - 1];
                      U[i][j] = t;
                    }
                  }
                }
                break;
              }
              case 3: {
                const scale = Math.max(
                  Math.abs(s[p - 1]),
                  Math.abs(s[p - 2]),
                  Math.abs(e[p - 2]),
                  Math.abs(s[k]),
                  Math.abs(e[k])
                );
                const sp = s[p - 1] / scale;
                const spm1 = s[p - 2] / scale;
                const epm1 = e[p - 2] / scale;
                const sk = s[k] / scale;
                const ek = e[k] / scale;
                const b = ((spm1 + sp) * (spm1 - sp) + epm1 * epm1) / 2;
                const c = sp * epm1 * (sp * epm1);
                let shift = 0;
                if (b !== 0 || c !== 0) {
                  if (b < 0) {
                    shift = 0 - Math.sqrt(b * b + c);
                  } else {
                    shift = Math.sqrt(b * b + c);
                  }
                  shift = c / (b + shift);
                }
                let f = (sk + sp) * (sk - sp) + shift;
                let g = sk * ek;
                for (let j = k; j < p - 1; j++) {
                  let t = hypotenuse(f, g);
                  if (t === 0) t = Number.MIN_VALUE;
                  let cs = f / t;
                  let sn = g / t;
                  if (j !== k) {
                    e[j - 1] = t;
                  }
                  f = cs * s[j] + sn * e[j];
                  e[j] = cs * e[j] - sn * s[j];
                  g = sn * s[j + 1];
                  s[j + 1] = cs * s[j + 1];
                  if (wantv) {
                    for (let i = 0; i < n; i++) {
                      t = cs * V[i][j] + sn * V[i][j + 1];
                      V[i][j + 1] = -sn * V[i][j] + cs * V[i][j + 1];
                      V[i][j] = t;
                    }
                  }
                  t = hypotenuse(f, g);
                  if (t === 0) t = Number.MIN_VALUE;
                  cs = f / t;
                  sn = g / t;
                  s[j] = t;
                  f = cs * e[j] + sn * s[j + 1];
                  s[j + 1] = -sn * e[j] + cs * s[j + 1];
                  g = sn * e[j + 1];
                  e[j + 1] = cs * e[j + 1];
                  if (wantu && j < m - 1) {
                    for (let i = 0; i < m; i++) {
                      t = cs * U[i][j] + sn * U[i][j + 1];
                      U[i][j + 1] = -sn * U[i][j] + cs * U[i][j + 1];
                      U[i][j] = t;
                    }
                  }
                }
                e[p - 2] = f;
                break;
              }
              case 4: {
                if (s[k] <= 0) {
                  s[k] = s[k] < 0 ? -s[k] : 0;
                  if (wantv) {
                    for (let i = 0; i <= pp; i++) {
                      V[i][k] = -V[i][k];
                    }
                  }
                }
                while (k < pp) {
                  if (s[k] >= s[k + 1]) {
                    break;
                  }
                  let t = s[k];
                  s[k] = s[k + 1];
                  s[k + 1] = t;
                  if (wantv && k < n - 1) {
                    for (let i = 0; i < n; i++) {
                      t = V[i][k + 1];
                      V[i][k + 1] = V[i][k];
                      V[i][k] = t;
                    }
                  }
                  if (wantu && k < m - 1) {
                    for (let i = 0; i < m; i++) {
                      t = U[i][k + 1];
                      U[i][k + 1] = U[i][k];
                      U[i][k] = t;
                    }
                  }
                  k++;
                }
                p--;
                break;
              }
            }
          }
          if (swapped) {
            var tmp = V;
            V = U;
            U = tmp;
          }
          this.m = m;
          this.n = n;
          this.s = s;
          this.U = U;
          this.V = V;
        }
        /**
         * Solve a problem of least square (Ax=b) by using the SVD. Useful when A is singular. When A is not singular, it would be better to use qr.solve(value).
         * Example : We search to approximate x, with A matrix shape m*n, x vector size n, b vector size m (m > n). We will use :
         * var svd = SingularValueDecomposition(A);
         * var x = svd.solve(b);
         * @param {Matrix} value - Matrix 1D which is the vector b (in the equation Ax = b)
         * @return {Matrix} - The vector x
         */
        solve(value) {
          var Y = value;
          var e = this.threshold;
          var scols = this.s.length;
          var Ls = Matrix3.zeros(scols, scols);
          for (let i = 0; i < scols; i++) {
            if (Math.abs(this.s[i]) <= e) {
              Ls[i][i] = 0;
            } else {
              Ls[i][i] = 1 / this.s[i];
            }
          }
          var U = this.U;
          var V = this.rightSingularVectors;
          var VL = V.mmul(Ls);
          var vrows = V.rows;
          var urows = U.length;
          var VLU = Matrix3.zeros(vrows, urows);
          for (let i = 0; i < vrows; i++) {
            for (let j = 0; j < urows; j++) {
              let sum2 = 0;
              for (let k = 0; k < scols; k++) {
                sum2 += VL[i][k] * U[j][k];
              }
              VLU[i][j] = sum2;
            }
          }
          return VLU.mmul(Y);
        }
        /**
         *
         * @param {Array<number>} value
         * @return {Matrix}
         */
        solveForDiagonal(value) {
          return this.solve(Matrix3.diag(value));
        }
        /**
         * Get the inverse of the matrix. We compute the inverse of a matrix using SVD when this matrix is singular or ill-conditioned. Example :
         * var svd = SingularValueDecomposition(A);
         * var inverseA = svd.inverse();
         * @return {Matrix} - The approximation of the inverse of the matrix
         */
        inverse() {
          var V = this.V;
          var e = this.threshold;
          var vrows = V.length;
          var vcols = V[0].length;
          var X = new Matrix3(vrows, this.s.length);
          for (let i = 0; i < vrows; i++) {
            for (let j = 0; j < vcols; j++) {
              if (Math.abs(this.s[j]) > e) {
                X[i][j] = V[i][j] / this.s[j];
              } else {
                X[i][j] = 0;
              }
            }
          }
          var U = this.U;
          var urows = U.length;
          var ucols = U[0].length;
          var Y = new Matrix3(vrows, urows);
          for (let i = 0; i < vrows; i++) {
            for (let j = 0; j < urows; j++) {
              let sum2 = 0;
              for (let k = 0; k < ucols; k++) {
                sum2 += X[i][k] * U[j][k];
              }
              Y[i][j] = sum2;
            }
          }
          return Y;
        }
        /**
         *
         * @return {number}
         */
        get condition() {
          return this.s[0] / this.s[Math.min(this.m, this.n) - 1];
        }
        /**
         *
         * @return {number}
         */
        get norm2() {
          return this.s[0];
        }
        /**
         *
         * @return {number}
         */
        get rank() {
          var tol = Math.max(this.m, this.n) * this.s[0] * Number.EPSILON;
          var r = 0;
          var s = this.s;
          for (var i = 0, ii = s.length; i < ii; i++) {
            if (s[i] > tol) {
              r++;
            }
          }
          return r;
        }
        /**
         *
         * @return {Array<number>}
         */
        get diagonal() {
          return this.s;
        }
        /**
         *
         * @return {number}
         */
        get threshold() {
          return Number.EPSILON / 2 * Math.max(this.m, this.n) * this.s[0];
        }
        /**
         *
         * @return {Matrix}
         */
        get leftSingularVectors() {
          if (!Matrix3.isMatrix(this.U)) {
            this.U = new Matrix3(this.U);
          }
          return this.U;
        }
        /**
         *
         * @return {Matrix}
         */
        get rightSingularVectors() {
          if (!Matrix3.isMatrix(this.V)) {
            this.V = new Matrix3(this.V);
          }
          return this.V;
        }
        /**
         *
         * @return {Matrix}
         */
        get diagonalMatrix() {
          return Matrix3.diag(this.s);
        }
      };
      function checkRowIndex(matrix2, index, outer) {
        var max2 = outer ? matrix2.rows : matrix2.rows - 1;
        if (index < 0 || index > max2) {
          throw new RangeError("Row index out of range");
        }
      }
      function checkColumnIndex(matrix2, index, outer) {
        var max2 = outer ? matrix2.columns : matrix2.columns - 1;
        if (index < 0 || index > max2) {
          throw new RangeError("Column index out of range");
        }
      }
      function checkRowVector(matrix2, vector) {
        if (vector.to1DArray) {
          vector = vector.to1DArray();
        }
        if (vector.length !== matrix2.columns) {
          throw new RangeError(
            "vector size must be the same as the number of columns"
          );
        }
        return vector;
      }
      function checkColumnVector(matrix2, vector) {
        if (vector.to1DArray) {
          vector = vector.to1DArray();
        }
        if (vector.length !== matrix2.rows) {
          throw new RangeError("vector size must be the same as the number of rows");
        }
        return vector;
      }
      function checkIndices(matrix2, rowIndices, columnIndices) {
        return {
          row: checkRowIndices(matrix2, rowIndices),
          column: checkColumnIndices(matrix2, columnIndices)
        };
      }
      function checkRowIndices(matrix2, rowIndices) {
        if (typeof rowIndices !== "object") {
          throw new TypeError("unexpected type for row indices");
        }
        var rowOut = rowIndices.some((r) => {
          return r < 0 || r >= matrix2.rows;
        });
        if (rowOut) {
          throw new RangeError("row indices are out of range");
        }
        if (!Array.isArray(rowIndices)) rowIndices = Array.from(rowIndices);
        return rowIndices;
      }
      function checkColumnIndices(matrix2, columnIndices) {
        if (typeof columnIndices !== "object") {
          throw new TypeError("unexpected type for column indices");
        }
        var columnOut = columnIndices.some((c) => {
          return c < 0 || c >= matrix2.columns;
        });
        if (columnOut) {
          throw new RangeError("column indices are out of range");
        }
        if (!Array.isArray(columnIndices)) columnIndices = Array.from(columnIndices);
        return columnIndices;
      }
      function checkRange(matrix2, startRow, endRow, startColumn, endColumn) {
        if (arguments.length !== 5) {
          throw new RangeError("expected 4 arguments");
        }
        checkNumber("startRow", startRow);
        checkNumber("endRow", endRow);
        checkNumber("startColumn", startColumn);
        checkNumber("endColumn", endColumn);
        if (startRow > endRow || startColumn > endColumn || startRow < 0 || startRow >= matrix2.rows || endRow < 0 || endRow >= matrix2.rows || startColumn < 0 || startColumn >= matrix2.columns || endColumn < 0 || endColumn >= matrix2.columns) {
          throw new RangeError("Submatrix indices are out of range");
        }
      }
      function sumByRow(matrix2) {
        var sum2 = Matrix3.zeros(matrix2.rows, 1);
        for (var i = 0; i < matrix2.rows; ++i) {
          for (var j = 0; j < matrix2.columns; ++j) {
            sum2.set(i, 0, sum2.get(i, 0) + matrix2.get(i, j));
          }
        }
        return sum2;
      }
      function sumByColumn(matrix2) {
        var sum2 = Matrix3.zeros(1, matrix2.columns);
        for (var i = 0; i < matrix2.rows; ++i) {
          for (var j = 0; j < matrix2.columns; ++j) {
            sum2.set(0, j, sum2.get(0, j) + matrix2.get(i, j));
          }
        }
        return sum2;
      }
      function sumAll(matrix2) {
        var v = 0;
        for (var i = 0; i < matrix2.rows; i++) {
          for (var j = 0; j < matrix2.columns; j++) {
            v += matrix2.get(i, j);
          }
        }
        return v;
      }
      function checkNumber(name, value) {
        if (typeof value !== "number") {
          throw new TypeError(`${name} must be a number`);
        }
      }
      var BaseView = class extends AbstractMatrix2() {
        constructor(matrix2, rows, columns) {
          super();
          this.matrix = matrix2;
          this.rows = rows;
          this.columns = columns;
        }
        static get [Symbol.species]() {
          return Matrix3;
        }
      };
      var MatrixTransposeView3 = class extends BaseView {
        constructor(matrix2) {
          super(matrix2, matrix2.columns, matrix2.rows);
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(columnIndex, rowIndex, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(columnIndex, rowIndex);
        }
      };
      var MatrixRowView2 = class extends BaseView {
        constructor(matrix2, row) {
          super(matrix2, 1, matrix2.columns);
          this.row = row;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(this.row, columnIndex, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(this.row, columnIndex);
        }
      };
      var MatrixSubView2 = class extends BaseView {
        constructor(matrix2, startRow, endRow, startColumn, endColumn) {
          checkRange(matrix2, startRow, endRow, startColumn, endColumn);
          super(matrix2, endRow - startRow + 1, endColumn - startColumn + 1);
          this.startRow = startRow;
          this.startColumn = startColumn;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(
            this.startRow + rowIndex,
            this.startColumn + columnIndex,
            value
          );
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(
            this.startRow + rowIndex,
            this.startColumn + columnIndex
          );
        }
      };
      var MatrixSelectionView2 = class extends BaseView {
        constructor(matrix2, rowIndices, columnIndices) {
          var indices = checkIndices(matrix2, rowIndices, columnIndices);
          super(matrix2, indices.row.length, indices.column.length);
          this.rowIndices = indices.row;
          this.columnIndices = indices.column;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(
            this.rowIndices[rowIndex],
            this.columnIndices[columnIndex],
            value
          );
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(
            this.rowIndices[rowIndex],
            this.columnIndices[columnIndex]
          );
        }
      };
      var MatrixRowSelectionView2 = class extends BaseView {
        constructor(matrix2, rowIndices) {
          rowIndices = checkRowIndices(matrix2, rowIndices);
          super(matrix2, rowIndices.length, matrix2.columns);
          this.rowIndices = rowIndices;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(this.rowIndices[rowIndex], columnIndex, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(this.rowIndices[rowIndex], columnIndex);
        }
      };
      var MatrixColumnSelectionView3 = class extends BaseView {
        constructor(matrix2, columnIndices) {
          columnIndices = checkColumnIndices(matrix2, columnIndices);
          super(matrix2, matrix2.rows, columnIndices.length);
          this.columnIndices = columnIndices;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(rowIndex, this.columnIndices[columnIndex], value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(rowIndex, this.columnIndices[columnIndex]);
        }
      };
      var MatrixColumnView2 = class extends BaseView {
        constructor(matrix2, column) {
          super(matrix2, matrix2.rows, 1);
          this.column = column;
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(rowIndex, this.column, value);
          return this;
        }
        get(rowIndex) {
          return this.matrix.get(rowIndex, this.column);
        }
      };
      var MatrixFlipRowView2 = class extends BaseView {
        constructor(matrix2) {
          super(matrix2, matrix2.rows, matrix2.columns);
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(this.rows - rowIndex - 1, columnIndex, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(this.rows - rowIndex - 1, columnIndex);
        }
      };
      var MatrixFlipColumnView2 = class extends BaseView {
        constructor(matrix2) {
          super(matrix2, matrix2.rows, matrix2.columns);
        }
        set(rowIndex, columnIndex, value) {
          this.matrix.set(rowIndex, this.columns - columnIndex - 1, value);
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.matrix.get(rowIndex, this.columns - columnIndex - 1);
        }
      };
      function AbstractMatrix2(superCtor) {
        if (superCtor === void 0) superCtor = Object;
        class Matrix4 extends superCtor {
          static get [Symbol.species]() {
            return this;
          }
          /**
           * Constructs a Matrix with the chosen dimensions from a 1D array
           * @param {number} newRows - Number of rows
           * @param {number} newColumns - Number of columns
           * @param {Array} newData - A 1D array containing data for the matrix
           * @return {Matrix} - The new matrix
           */
          static from1DArray(newRows, newColumns, newData) {
            var length = newRows * newColumns;
            if (length !== newData.length) {
              throw new RangeError("Data length does not match given dimensions");
            }
            var newMatrix = new this(newRows, newColumns);
            for (var row = 0; row < newRows; row++) {
              for (var column = 0; column < newColumns; column++) {
                newMatrix.set(row, column, newData[row * newColumns + column]);
              }
            }
            return newMatrix;
          }
          /**
               * Creates a row vector, a matrix with only one row.
               * @param {Array} newData - A 1D array containing data for the vector
               * @return {Matrix} - The new matrix
               */
          static rowVector(newData) {
            var vector = new this(1, newData.length);
            for (var i2 = 0; i2 < newData.length; i2++) {
              vector.set(0, i2, newData[i2]);
            }
            return vector;
          }
          /**
               * Creates a column vector, a matrix with only one column.
               * @param {Array} newData - A 1D array containing data for the vector
               * @return {Matrix} - The new matrix
               */
          static columnVector(newData) {
            var vector = new this(newData.length, 1);
            for (var i2 = 0; i2 < newData.length; i2++) {
              vector.set(i2, 0, newData[i2]);
            }
            return vector;
          }
          /**
               * Creates an empty matrix with the given dimensions. Values will be undefined. Same as using new Matrix(rows, columns).
               * @param {number} rows - Number of rows
               * @param {number} columns - Number of columns
               * @return {Matrix} - The new matrix
               */
          static empty(rows, columns) {
            return new this(rows, columns);
          }
          /**
               * Creates a matrix with the given dimensions. Values will be set to zero.
               * @param {number} rows - Number of rows
               * @param {number} columns - Number of columns
               * @return {Matrix} - The new matrix
               */
          static zeros(rows, columns) {
            return this.empty(rows, columns).fill(0);
          }
          /**
               * Creates a matrix with the given dimensions. Values will be set to one.
               * @param {number} rows - Number of rows
               * @param {number} columns - Number of columns
               * @return {Matrix} - The new matrix
               */
          static ones(rows, columns) {
            return this.empty(rows, columns).fill(1);
          }
          /**
               * Creates a matrix with the given dimensions. Values will be randomly set.
               * @param {number} rows - Number of rows
               * @param {number} columns - Number of columns
               * @param {function} [rng=Math.random] - Random number generator
               * @return {Matrix} The new matrix
               */
          static rand(rows, columns, rng) {
            if (rng === void 0) rng = Math.random;
            var matrix2 = this.empty(rows, columns);
            for (var i2 = 0; i2 < rows; i2++) {
              for (var j = 0; j < columns; j++) {
                matrix2.set(i2, j, rng());
              }
            }
            return matrix2;
          }
          /**
               * Creates a matrix with the given dimensions. Values will be random integers.
               * @param {number} rows - Number of rows
               * @param {number} columns - Number of columns
               * @param {number} [maxValue=1000] - Maximum value
               * @param {function} [rng=Math.random] - Random number generator
               * @return {Matrix} The new matrix
               */
          static randInt(rows, columns, maxValue, rng) {
            if (maxValue === void 0) maxValue = 1e3;
            if (rng === void 0) rng = Math.random;
            var matrix2 = this.empty(rows, columns);
            for (var i2 = 0; i2 < rows; i2++) {
              for (var j = 0; j < columns; j++) {
                var value = Math.floor(rng() * maxValue);
                matrix2.set(i2, j, value);
              }
            }
            return matrix2;
          }
          /**
               * Creates an identity matrix with the given dimension. Values of the diagonal will be 1 and others will be 0.
               * @param {number} rows - Number of rows
               * @param {number} [columns=rows] - Number of columns
               * @param {number} [value=1] - Value to fill the diagonal with
               * @return {Matrix} - The new identity matrix
               */
          static eye(rows, columns, value) {
            if (columns === void 0) columns = rows;
            if (value === void 0) value = 1;
            var min = Math.min(rows, columns);
            var matrix2 = this.zeros(rows, columns);
            for (var i2 = 0; i2 < min; i2++) {
              matrix2.set(i2, i2, value);
            }
            return matrix2;
          }
          /**
               * Creates a diagonal matrix based on the given array.
               * @param {Array} data - Array containing the data for the diagonal
               * @param {number} [rows] - Number of rows (Default: data.length)
               * @param {number} [columns] - Number of columns (Default: rows)
               * @return {Matrix} - The new diagonal matrix
               */
          static diag(data, rows, columns) {
            var l = data.length;
            if (rows === void 0) rows = l;
            if (columns === void 0) columns = rows;
            var min = Math.min(l, rows, columns);
            var matrix2 = this.zeros(rows, columns);
            for (var i2 = 0; i2 < min; i2++) {
              matrix2.set(i2, i2, data[i2]);
            }
            return matrix2;
          }
          /**
               * Returns a matrix whose elements are the minimum between matrix1 and matrix2
               * @param {Matrix} matrix1
               * @param {Matrix} matrix2
               * @return {Matrix}
               */
          static min(matrix1, matrix2) {
            matrix1 = this.checkMatrix(matrix1);
            matrix2 = this.checkMatrix(matrix2);
            var rows = matrix1.rows;
            var columns = matrix1.columns;
            var result = new this(rows, columns);
            for (var i2 = 0; i2 < rows; i2++) {
              for (var j = 0; j < columns; j++) {
                result.set(i2, j, Math.min(matrix1.get(i2, j), matrix2.get(i2, j)));
              }
            }
            return result;
          }
          /**
               * Returns a matrix whose elements are the maximum between matrix1 and matrix2
               * @param {Matrix} matrix1
               * @param {Matrix} matrix2
               * @return {Matrix}
               */
          static max(matrix1, matrix2) {
            matrix1 = this.checkMatrix(matrix1);
            matrix2 = this.checkMatrix(matrix2);
            var rows = matrix1.rows;
            var columns = matrix1.columns;
            var result = new this(rows, columns);
            for (var i2 = 0; i2 < rows; i2++) {
              for (var j = 0; j < columns; j++) {
                result.set(i2, j, Math.max(matrix1.get(i2, j), matrix2.get(i2, j)));
              }
            }
            return result;
          }
          /**
               * Check that the provided value is a Matrix and tries to instantiate one if not
               * @param {*} value - The value to check
               * @return {Matrix}
               */
          static checkMatrix(value) {
            return Matrix4.isMatrix(value) ? value : new this(value);
          }
          /**
               * Returns true if the argument is a Matrix, false otherwise
               * @param {*} value - The value to check
               * @return {boolean}
               */
          static isMatrix(value) {
            return value != null && value.klass === "Matrix";
          }
          /**
               * @prop {number} size - The number of elements in the matrix.
               */
          get size() {
            return this.rows * this.columns;
          }
          /**
               * Applies a callback for each element of the matrix. The function is called in the matrix (this) context.
               * @param {function} callback - Function that will be called with two parameters : i (row) and j (column)
               * @return {Matrix} this
               */
          apply(callback) {
            if (typeof callback !== "function") {
              throw new TypeError("callback must be a function");
            }
            var ii = this.rows;
            var jj = this.columns;
            for (var i2 = 0; i2 < ii; i2++) {
              for (var j = 0; j < jj; j++) {
                callback.call(this, i2, j);
              }
            }
            return this;
          }
          /**
               * Returns a new 1D array filled row by row with the matrix values
               * @return {Array}
               */
          to1DArray() {
            var array = new Array(this.size);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                array[i2 * this.columns + j] = this.get(i2, j);
              }
            }
            return array;
          }
          /**
               * Returns a 2D array containing a copy of the data
               * @return {Array}
               */
          to2DArray() {
            var copy = new Array(this.rows);
            for (var i2 = 0; i2 < this.rows; i2++) {
              copy[i2] = new Array(this.columns);
              for (var j = 0; j < this.columns; j++) {
                copy[i2][j] = this.get(i2, j);
              }
            }
            return copy;
          }
          /**
               * @return {boolean} true if the matrix has one row
               */
          isRowVector() {
            return this.rows === 1;
          }
          /**
               * @return {boolean} true if the matrix has one column
               */
          isColumnVector() {
            return this.columns === 1;
          }
          /**
               * @return {boolean} true if the matrix has one row or one column
               */
          isVector() {
            return this.rows === 1 || this.columns === 1;
          }
          /**
               * @return {boolean} true if the matrix has the same number of rows and columns
               */
          isSquare() {
            return this.rows === this.columns;
          }
          /**
               * @return {boolean} true if the matrix is square and has the same values on both sides of the diagonal
               */
          isSymmetric() {
            if (this.isSquare()) {
              for (var i2 = 0; i2 < this.rows; i2++) {
                for (var j = 0; j <= i2; j++) {
                  if (this.get(i2, j) !== this.get(j, i2)) {
                    return false;
                  }
                }
              }
              return true;
            }
            return false;
          }
          /**
                * @return true if the matrix is in echelon form
                */
          isEchelonForm() {
            let i2 = 0;
            let j = 0;
            let previousColumn = -1;
            let isEchelonForm = true;
            let checked = false;
            while (i2 < this.rows && isEchelonForm) {
              j = 0;
              checked = false;
              while (j < this.columns && checked === false) {
                if (this.get(i2, j) === 0) {
                  j++;
                } else if (this.get(i2, j) === 1 && j > previousColumn) {
                  checked = true;
                  previousColumn = j;
                } else {
                  isEchelonForm = false;
                  checked = true;
                }
              }
              i2++;
            }
            return isEchelonForm;
          }
          /**
                   * @return true if the matrix is in reduced echelon form
                   */
          isReducedEchelonForm() {
            let i2 = 0;
            let j = 0;
            let previousColumn = -1;
            let isReducedEchelonForm = true;
            let checked = false;
            while (i2 < this.rows && isReducedEchelonForm) {
              j = 0;
              checked = false;
              while (j < this.columns && checked === false) {
                if (this.get(i2, j) === 0) {
                  j++;
                } else if (this.get(i2, j) === 1 && j > previousColumn) {
                  checked = true;
                  previousColumn = j;
                } else {
                  isReducedEchelonForm = false;
                  checked = true;
                }
              }
              for (let k = j + 1; k < this.rows; k++) {
                if (this.get(i2, k) !== 0) {
                  isReducedEchelonForm = false;
                }
              }
              i2++;
            }
            return isReducedEchelonForm;
          }
          /**
               * Sets a given element of the matrix. mat.set(3,4,1) is equivalent to mat[3][4]=1
               * @abstract
               * @param {number} rowIndex - Index of the row
               * @param {number} columnIndex - Index of the column
               * @param {number} value - The new value for the element
               * @return {Matrix} this
               */
          set(rowIndex, columnIndex, value) {
            throw new Error("set method is unimplemented");
          }
          /**
               * Returns the given element of the matrix. mat.get(3,4) is equivalent to matrix[3][4]
               * @abstract
               * @param {number} rowIndex - Index of the row
               * @param {number} columnIndex - Index of the column
               * @return {number}
               */
          get(rowIndex, columnIndex) {
            throw new Error("get method is unimplemented");
          }
          /**
               * Creates a new matrix that is a repetition of the current matrix. New matrix has rowRep times the number of
               * rows of the matrix, and colRep times the number of columns of the matrix
               * @param {number} rowRep - Number of times the rows should be repeated
               * @param {number} colRep - Number of times the columns should be re
               * @return {Matrix}
               * @example
               * var matrix = new Matrix([[1,2]]);
               * matrix.repeat(2); // [[1,2],[1,2]]
               */
          repeat(rowRep, colRep) {
            rowRep = rowRep || 1;
            colRep = colRep || 1;
            var matrix2 = new this.constructor[Symbol.species](this.rows * rowRep, this.columns * colRep);
            for (var i2 = 0; i2 < rowRep; i2++) {
              for (var j = 0; j < colRep; j++) {
                matrix2.setSubMatrix(this, this.rows * i2, this.columns * j);
              }
            }
            return matrix2;
          }
          /**
               * Fills the matrix with a given value. All elements will be set to this value.
               * @param {number} value - New value
               * @return {Matrix} this
               */
          fill(value) {
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, value);
              }
            }
            return this;
          }
          /**
               * Negates the matrix. All elements will be multiplied by (-1)
               * @return {Matrix} this
               */
          neg() {
            return this.mulS(-1);
          }
          /**
               * Returns a new array from the given row index
               * @param {number} index - Row index
               * @return {Array}
               */
          getRow(index) {
            checkRowIndex(this, index);
            var row = new Array(this.columns);
            for (var i2 = 0; i2 < this.columns; i2++) {
              row[i2] = this.get(index, i2);
            }
            return row;
          }
          /**
               * Returns a new row vector from the given row index
               * @param {number} index - Row index
               * @return {Matrix}
               */
          getRowVector(index) {
            return this.constructor.rowVector(this.getRow(index));
          }
          /**
               * Sets a row at the given index
               * @param {number} index - Row index
               * @param {Array|Matrix} array - Array or vector
               * @return {Matrix} this
               */
          setRow(index, array) {
            checkRowIndex(this, index);
            array = checkRowVector(this, array);
            for (var i2 = 0; i2 < this.columns; i2++) {
              this.set(index, i2, array[i2]);
            }
            return this;
          }
          /**
               * Swaps two rows
               * @param {number} row1 - First row index
               * @param {number} row2 - Second row index
               * @return {Matrix} this
               */
          swapRows(row1, row2) {
            checkRowIndex(this, row1);
            checkRowIndex(this, row2);
            for (var i2 = 0; i2 < this.columns; i2++) {
              var temp = this.get(row1, i2);
              this.set(row1, i2, this.get(row2, i2));
              this.set(row2, i2, temp);
            }
            return this;
          }
          /**
               * Returns a new array from the given column index
               * @param {number} index - Column index
               * @return {Array}
               */
          getColumn(index) {
            checkColumnIndex(this, index);
            var column = new Array(this.rows);
            for (var i2 = 0; i2 < this.rows; i2++) {
              column[i2] = this.get(i2, index);
            }
            return column;
          }
          /**
               * Returns a new column vector from the given column index
               * @param {number} index - Column index
               * @return {Matrix}
               */
          getColumnVector(index) {
            return this.constructor.columnVector(this.getColumn(index));
          }
          /**
               * Sets a column at the given index
               * @param {number} index - Column index
               * @param {Array|Matrix} array - Array or vector
               * @return {Matrix} this
               */
          setColumn(index, array) {
            checkColumnIndex(this, index);
            array = checkColumnVector(this, array);
            for (var i2 = 0; i2 < this.rows; i2++) {
              this.set(i2, index, array[i2]);
            }
            return this;
          }
          /**
               * Swaps two columns
               * @param {number} column1 - First column index
               * @param {number} column2 - Second column index
               * @return {Matrix} this
               */
          swapColumns(column1, column2) {
            checkColumnIndex(this, column1);
            checkColumnIndex(this, column2);
            for (var i2 = 0; i2 < this.rows; i2++) {
              var temp = this.get(i2, column1);
              this.set(i2, column1, this.get(i2, column2));
              this.set(i2, column2, temp);
            }
            return this;
          }
          /**
               * Adds the values of a vector to each row
               * @param {Array|Matrix} vector - Array or vector
               * @return {Matrix} this
               */
          addRowVector(vector) {
            vector = checkRowVector(this, vector);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, this.get(i2, j) + vector[j]);
              }
            }
            return this;
          }
          /**
               * Subtracts the values of a vector from each row
               * @param {Array|Matrix} vector - Array or vector
               * @return {Matrix} this
               */
          subRowVector(vector) {
            vector = checkRowVector(this, vector);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, this.get(i2, j) - vector[j]);
              }
            }
            return this;
          }
          /**
               * Multiplies the values of a vector with each row
               * @param {Array|Matrix} vector - Array or vector
               * @return {Matrix} this
               */
          mulRowVector(vector) {
            vector = checkRowVector(this, vector);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, this.get(i2, j) * vector[j]);
              }
            }
            return this;
          }
          /**
               * Divides the values of each row by those of a vector
               * @param {Array|Matrix} vector - Array or vector
               * @return {Matrix} this
               */
          divRowVector(vector) {
            vector = checkRowVector(this, vector);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, this.get(i2, j) / vector[j]);
              }
            }
            return this;
          }
          /**
               * Adds the values of a vector to each column
               * @param {Array|Matrix} vector - Array or vector
               * @return {Matrix} this
               */
          addColumnVector(vector) {
            vector = checkColumnVector(this, vector);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, this.get(i2, j) + vector[i2]);
              }
            }
            return this;
          }
          /**
               * Subtracts the values of a vector from each column
               * @param {Array|Matrix} vector - Array or vector
               * @return {Matrix} this
               */
          subColumnVector(vector) {
            vector = checkColumnVector(this, vector);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, this.get(i2, j) - vector[i2]);
              }
            }
            return this;
          }
          /**
               * Multiplies the values of a vector with each column
               * @param {Array|Matrix} vector - Array or vector
               * @return {Matrix} this
               */
          mulColumnVector(vector) {
            vector = checkColumnVector(this, vector);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, this.get(i2, j) * vector[i2]);
              }
            }
            return this;
          }
          /**
               * Divides the values of each column by those of a vector
               * @param {Array|Matrix} vector - Array or vector
               * @return {Matrix} this
               */
          divColumnVector(vector) {
            vector = checkColumnVector(this, vector);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                this.set(i2, j, this.get(i2, j) / vector[i2]);
              }
            }
            return this;
          }
          /**
               * Multiplies the values of a row with a scalar
               * @param {number} index - Row index
               * @param {number} value
               * @return {Matrix} this
               */
          mulRow(index, value) {
            checkRowIndex(this, index);
            for (var i2 = 0; i2 < this.columns; i2++) {
              this.set(index, i2, this.get(index, i2) * value);
            }
            return this;
          }
          /**
               * Multiplies the values of a column with a scalar
               * @param {number} index - Column index
               * @param {number} value
               * @return {Matrix} this
               */
          mulColumn(index, value) {
            checkColumnIndex(this, index);
            for (var i2 = 0; i2 < this.rows; i2++) {
              this.set(i2, index, this.get(i2, index) * value);
            }
            return this;
          }
          /**
               * Returns the maximum value of the matrix
               * @return {number}
               */
          max() {
            var v = this.get(0, 0);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                if (this.get(i2, j) > v) {
                  v = this.get(i2, j);
                }
              }
            }
            return v;
          }
          /**
               * Returns the index of the maximum value
               * @return {Array}
               */
          maxIndex() {
            var v = this.get(0, 0);
            var idx = [0, 0];
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                if (this.get(i2, j) > v) {
                  v = this.get(i2, j);
                  idx[0] = i2;
                  idx[1] = j;
                }
              }
            }
            return idx;
          }
          /**
               * Returns the minimum value of the matrix
               * @return {number}
               */
          min() {
            var v = this.get(0, 0);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                if (this.get(i2, j) < v) {
                  v = this.get(i2, j);
                }
              }
            }
            return v;
          }
          /**
               * Returns the index of the minimum value
               * @return {Array}
               */
          minIndex() {
            var v = this.get(0, 0);
            var idx = [0, 0];
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                if (this.get(i2, j) < v) {
                  v = this.get(i2, j);
                  idx[0] = i2;
                  idx[1] = j;
                }
              }
            }
            return idx;
          }
          /**
               * Returns the maximum value of one row
               * @param {number} row - Row index
               * @return {number}
               */
          maxRow(row) {
            checkRowIndex(this, row);
            var v = this.get(row, 0);
            for (var i2 = 1; i2 < this.columns; i2++) {
              if (this.get(row, i2) > v) {
                v = this.get(row, i2);
              }
            }
            return v;
          }
          /**
               * Returns the index of the maximum value of one row
               * @param {number} row - Row index
               * @return {Array}
               */
          maxRowIndex(row) {
            checkRowIndex(this, row);
            var v = this.get(row, 0);
            var idx = [row, 0];
            for (var i2 = 1; i2 < this.columns; i2++) {
              if (this.get(row, i2) > v) {
                v = this.get(row, i2);
                idx[1] = i2;
              }
            }
            return idx;
          }
          /**
               * Returns the minimum value of one row
               * @param {number} row - Row index
               * @return {number}
               */
          minRow(row) {
            checkRowIndex(this, row);
            var v = this.get(row, 0);
            for (var i2 = 1; i2 < this.columns; i2++) {
              if (this.get(row, i2) < v) {
                v = this.get(row, i2);
              }
            }
            return v;
          }
          /**
               * Returns the index of the maximum value of one row
               * @param {number} row - Row index
               * @return {Array}
               */
          minRowIndex(row) {
            checkRowIndex(this, row);
            var v = this.get(row, 0);
            var idx = [row, 0];
            for (var i2 = 1; i2 < this.columns; i2++) {
              if (this.get(row, i2) < v) {
                v = this.get(row, i2);
                idx[1] = i2;
              }
            }
            return idx;
          }
          /**
               * Returns the maximum value of one column
               * @param {number} column - Column index
               * @return {number}
               */
          maxColumn(column) {
            checkColumnIndex(this, column);
            var v = this.get(0, column);
            for (var i2 = 1; i2 < this.rows; i2++) {
              if (this.get(i2, column) > v) {
                v = this.get(i2, column);
              }
            }
            return v;
          }
          /**
               * Returns the index of the maximum value of one column
               * @param {number} column - Column index
               * @return {Array}
               */
          maxColumnIndex(column) {
            checkColumnIndex(this, column);
            var v = this.get(0, column);
            var idx = [0, column];
            for (var i2 = 1; i2 < this.rows; i2++) {
              if (this.get(i2, column) > v) {
                v = this.get(i2, column);
                idx[0] = i2;
              }
            }
            return idx;
          }
          /**
               * Returns the minimum value of one column
               * @param {number} column - Column index
               * @return {number}
               */
          minColumn(column) {
            checkColumnIndex(this, column);
            var v = this.get(0, column);
            for (var i2 = 1; i2 < this.rows; i2++) {
              if (this.get(i2, column) < v) {
                v = this.get(i2, column);
              }
            }
            return v;
          }
          /**
               * Returns the index of the minimum value of one column
               * @param {number} column - Column index
               * @return {Array}
               */
          minColumnIndex(column) {
            checkColumnIndex(this, column);
            var v = this.get(0, column);
            var idx = [0, column];
            for (var i2 = 1; i2 < this.rows; i2++) {
              if (this.get(i2, column) < v) {
                v = this.get(i2, column);
                idx[0] = i2;
              }
            }
            return idx;
          }
          /**
               * Returns an array containing the diagonal values of the matrix
               * @return {Array}
               */
          diag() {
            var min = Math.min(this.rows, this.columns);
            var diag = new Array(min);
            for (var i2 = 0; i2 < min; i2++) {
              diag[i2] = this.get(i2, i2);
            }
            return diag;
          }
          /**
               * Returns the sum by the argument given, if no argument given,
               * it returns the sum of all elements of the matrix.
               * @param {string} by - sum by 'row' or 'column'.
               * @return {Matrix|number}
               */
          sum(by) {
            switch (by) {
              case "row":
                return sumByRow(this);
              case "column":
                return sumByColumn(this);
              default:
                return sumAll(this);
            }
          }
          /**
               * Returns the mean of all elements of the matrix
               * @return {number}
               */
          mean() {
            return this.sum() / this.size;
          }
          /**
               * Returns the product of all elements of the matrix
               * @return {number}
               */
          prod() {
            var prod = 1;
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                prod *= this.get(i2, j);
              }
            }
            return prod;
          }
          /**
               * Returns the norm of a matrix.
               * @param {string} type - "frobenius" (default) or "max" return resp. the Frobenius norm and the max norm.
               * @return {number}
               */
          norm(type = "frobenius") {
            var result = 0;
            if (type === "max") {
              return this.max();
            } else if (type === "frobenius") {
              for (var i2 = 0; i2 < this.rows; i2++) {
                for (var j = 0; j < this.columns; j++) {
                  result = result + this.get(i2, j) * this.get(i2, j);
                }
              }
              return Math.sqrt(result);
            } else {
              throw new RangeError(`unknown norm type: ${type}`);
            }
          }
          /**
               * Computes the cumulative sum of the matrix elements (in place, row by row)
               * @return {Matrix} this
               */
          cumulativeSum() {
            var sum2 = 0;
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                sum2 += this.get(i2, j);
                this.set(i2, j, sum2);
              }
            }
            return this;
          }
          /**
               * Computes the dot (scalar) product between the matrix and another
               * @param {Matrix} vector2 vector
               * @return {number}
               */
          dot(vector2) {
            if (Matrix4.isMatrix(vector2)) vector2 = vector2.to1DArray();
            var vector1 = this.to1DArray();
            if (vector1.length !== vector2.length) {
              throw new RangeError("vectors do not have the same size");
            }
            var dot = 0;
            for (var i2 = 0; i2 < vector1.length; i2++) {
              dot += vector1[i2] * vector2[i2];
            }
            return dot;
          }
          /**
               * Returns the matrix product between this and other
               * @param {Matrix} other
               * @return {Matrix}
               */
          mmul(other) {
            other = this.constructor.checkMatrix(other);
            if (this.columns !== other.rows) {
              console.warn("Number of columns of left matrix are not equal to number of rows of right matrix.");
            }
            var m = this.rows;
            var n = this.columns;
            var p = other.columns;
            var result = new this.constructor[Symbol.species](m, p);
            var Bcolj = new Array(n);
            for (var j = 0; j < p; j++) {
              for (var k = 0; k < n; k++) {
                Bcolj[k] = other.get(k, j);
              }
              for (var i2 = 0; i2 < m; i2++) {
                var s = 0;
                for (k = 0; k < n; k++) {
                  s += this.get(i2, k) * Bcolj[k];
                }
                result.set(i2, j, s);
              }
            }
            return result;
          }
          strassen2x2(other) {
            var result = new this.constructor[Symbol.species](2, 2);
            const a11 = this.get(0, 0);
            const b11 = other.get(0, 0);
            const a12 = this.get(0, 1);
            const b12 = other.get(0, 1);
            const a21 = this.get(1, 0);
            const b21 = other.get(1, 0);
            const a22 = this.get(1, 1);
            const b22 = other.get(1, 1);
            const m1 = (a11 + a22) * (b11 + b22);
            const m2 = (a21 + a22) * b11;
            const m3 = a11 * (b12 - b22);
            const m4 = a22 * (b21 - b11);
            const m5 = (a11 + a12) * b22;
            const m6 = (a21 - a11) * (b11 + b12);
            const m7 = (a12 - a22) * (b21 + b22);
            const c00 = m1 + m4 - m5 + m7;
            const c01 = m3 + m5;
            const c10 = m2 + m4;
            const c11 = m1 - m2 + m3 + m6;
            result.set(0, 0, c00);
            result.set(0, 1, c01);
            result.set(1, 0, c10);
            result.set(1, 1, c11);
            return result;
          }
          strassen3x3(other) {
            var result = new this.constructor[Symbol.species](3, 3);
            const a00 = this.get(0, 0);
            const a01 = this.get(0, 1);
            const a02 = this.get(0, 2);
            const a10 = this.get(1, 0);
            const a11 = this.get(1, 1);
            const a12 = this.get(1, 2);
            const a20 = this.get(2, 0);
            const a21 = this.get(2, 1);
            const a22 = this.get(2, 2);
            const b00 = other.get(0, 0);
            const b01 = other.get(0, 1);
            const b02 = other.get(0, 2);
            const b10 = other.get(1, 0);
            const b11 = other.get(1, 1);
            const b12 = other.get(1, 2);
            const b20 = other.get(2, 0);
            const b21 = other.get(2, 1);
            const b22 = other.get(2, 2);
            const m1 = (a00 + a01 + a02 - a10 - a11 - a21 - a22) * b11;
            const m2 = (a00 - a10) * (-b01 + b11);
            const m3 = a11 * (-b00 + b01 + b10 - b11 - b12 - b20 + b22);
            const m4 = (-a00 + a10 + a11) * (b00 - b01 + b11);
            const m5 = (a10 + a11) * (-b00 + b01);
            const m6 = a00 * b00;
            const m7 = (-a00 + a20 + a21) * (b00 - b02 + b12);
            const m8 = (-a00 + a20) * (b02 - b12);
            const m9 = (a20 + a21) * (-b00 + b02);
            const m10 = (a00 + a01 + a02 - a11 - a12 - a20 - a21) * b12;
            const m11 = a21 * (-b00 + b02 + b10 - b11 - b12 - b20 + b21);
            const m12 = (-a02 + a21 + a22) * (b11 + b20 - b21);
            const m13 = (a02 - a22) * (b11 - b21);
            const m14 = a02 * b20;
            const m15 = (a21 + a22) * (-b20 + b21);
            const m16 = (-a02 + a11 + a12) * (b12 + b20 - b22);
            const m17 = (a02 - a12) * (b12 - b22);
            const m18 = (a11 + a12) * (-b20 + b22);
            const m19 = a01 * b10;
            const m20 = a12 * b21;
            const m21 = a10 * b02;
            const m22 = a20 * b01;
            const m23 = a22 * b22;
            const c00 = m6 + m14 + m19;
            const c01 = m1 + m4 + m5 + m6 + m12 + m14 + m15;
            const c02 = m6 + m7 + m9 + m10 + m14 + m16 + m18;
            const c10 = m2 + m3 + m4 + m6 + m14 + m16 + m17;
            const c11 = m2 + m4 + m5 + m6 + m20;
            const c12 = m14 + m16 + m17 + m18 + m21;
            const c20 = m6 + m7 + m8 + m11 + m12 + m13 + m14;
            const c21 = m12 + m13 + m14 + m15 + m22;
            const c22 = m6 + m7 + m8 + m9 + m23;
            result.set(0, 0, c00);
            result.set(0, 1, c01);
            result.set(0, 2, c02);
            result.set(1, 0, c10);
            result.set(1, 1, c11);
            result.set(1, 2, c12);
            result.set(2, 0, c20);
            result.set(2, 1, c21);
            result.set(2, 2, c22);
            return result;
          }
          /**
               * Returns the matrix product between x and y. More efficient than mmul(other) only when we multiply squared matrix and when the size of the matrix is > 1000.
               * @param {Matrix} y
               * @return {Matrix}
               */
          mmulStrassen(y) {
            var x = this.clone();
            var r1 = x.rows;
            var c1 = x.columns;
            var r2 = y.rows;
            var c2 = y.columns;
            if (c1 !== r2) {
              console.warn(`Multiplying ${r1} x ${c1} and ${r2} x ${c2} matrix: dimensions do not match.`);
            }
            function embed(mat, rows, cols) {
              var r3 = mat.rows;
              var c3 = mat.columns;
              if (r3 === rows && c3 === cols) {
                return mat;
              } else {
                var resultat = Matrix4.zeros(rows, cols);
                resultat = resultat.setSubMatrix(mat, 0, 0);
                return resultat;
              }
            }
            var r = Math.max(r1, r2);
            var c = Math.max(c1, c2);
            x = embed(x, r, c);
            y = embed(y, r, c);
            function blockMult(a, b, rows, cols) {
              if (rows <= 512 || cols <= 512) {
                return a.mmul(b);
              }
              if (rows % 2 === 1 && cols % 2 === 1) {
                a = embed(a, rows + 1, cols + 1);
                b = embed(b, rows + 1, cols + 1);
              } else if (rows % 2 === 1) {
                a = embed(a, rows + 1, cols);
                b = embed(b, rows + 1, cols);
              } else if (cols % 2 === 1) {
                a = embed(a, rows, cols + 1);
                b = embed(b, rows, cols + 1);
              }
              var halfRows = parseInt(a.rows / 2, 10);
              var halfCols = parseInt(a.columns / 2, 10);
              var a11 = a.subMatrix(0, halfRows - 1, 0, halfCols - 1);
              var b11 = b.subMatrix(0, halfRows - 1, 0, halfCols - 1);
              var a12 = a.subMatrix(0, halfRows - 1, halfCols, a.columns - 1);
              var b12 = b.subMatrix(0, halfRows - 1, halfCols, b.columns - 1);
              var a21 = a.subMatrix(halfRows, a.rows - 1, 0, halfCols - 1);
              var b21 = b.subMatrix(halfRows, b.rows - 1, 0, halfCols - 1);
              var a22 = a.subMatrix(halfRows, a.rows - 1, halfCols, a.columns - 1);
              var b22 = b.subMatrix(halfRows, b.rows - 1, halfCols, b.columns - 1);
              var m1 = blockMult(Matrix4.add(a11, a22), Matrix4.add(b11, b22), halfRows, halfCols);
              var m2 = blockMult(Matrix4.add(a21, a22), b11, halfRows, halfCols);
              var m3 = blockMult(a11, Matrix4.sub(b12, b22), halfRows, halfCols);
              var m4 = blockMult(a22, Matrix4.sub(b21, b11), halfRows, halfCols);
              var m5 = blockMult(Matrix4.add(a11, a12), b22, halfRows, halfCols);
              var m6 = blockMult(Matrix4.sub(a21, a11), Matrix4.add(b11, b12), halfRows, halfCols);
              var m7 = blockMult(Matrix4.sub(a12, a22), Matrix4.add(b21, b22), halfRows, halfCols);
              var c11 = Matrix4.add(m1, m4);
              c11.sub(m5);
              c11.add(m7);
              var c12 = Matrix4.add(m3, m5);
              var c21 = Matrix4.add(m2, m4);
              var c22 = Matrix4.sub(m1, m2);
              c22.add(m3);
              c22.add(m6);
              var resultat = Matrix4.zeros(2 * c11.rows, 2 * c11.columns);
              resultat = resultat.setSubMatrix(c11, 0, 0);
              resultat = resultat.setSubMatrix(c12, c11.rows, 0);
              resultat = resultat.setSubMatrix(c21, 0, c11.columns);
              resultat = resultat.setSubMatrix(c22, c11.rows, c11.columns);
              return resultat.subMatrix(0, rows - 1, 0, cols - 1);
            }
            return blockMult(x, y, r, c);
          }
          /**
               * Returns a row-by-row scaled matrix
               * @param {number} [min=0] - Minimum scaled value
               * @param {number} [max=1] - Maximum scaled value
               * @return {Matrix} - The scaled matrix
               */
          scaleRows(min, max2) {
            min = min === void 0 ? 0 : min;
            max2 = max2 === void 0 ? 1 : max2;
            if (min >= max2) {
              throw new RangeError("min should be strictly smaller than max");
            }
            var newMatrix = this.constructor.empty(this.rows, this.columns);
            for (var i2 = 0; i2 < this.rows; i2++) {
              var scaled = rescale(this.getRow(i2), { min, max: max2 });
              newMatrix.setRow(i2, scaled);
            }
            return newMatrix;
          }
          /**
               * Returns a new column-by-column scaled matrix
               * @param {number} [min=0] - Minimum scaled value
               * @param {number} [max=1] - Maximum scaled value
               * @return {Matrix} - The new scaled matrix
               * @example
               * var matrix = new Matrix([[1,2],[-1,0]]);
               * var scaledMatrix = matrix.scaleColumns(); // [[1,1],[0,0]]
               */
          scaleColumns(min, max2) {
            min = min === void 0 ? 0 : min;
            max2 = max2 === void 0 ? 1 : max2;
            if (min >= max2) {
              throw new RangeError("min should be strictly smaller than max");
            }
            var newMatrix = this.constructor.empty(this.rows, this.columns);
            for (var i2 = 0; i2 < this.columns; i2++) {
              var scaled = rescale(this.getColumn(i2), {
                min,
                max: max2
              });
              newMatrix.setColumn(i2, scaled);
            }
            return newMatrix;
          }
          /**
               * Returns the Kronecker product (also known as tensor product) between this and other
               * See https://en.wikipedia.org/wiki/Kronecker_product
               * @param {Matrix} other
               * @return {Matrix}
               */
          kroneckerProduct(other) {
            other = this.constructor.checkMatrix(other);
            var m = this.rows;
            var n = this.columns;
            var p = other.rows;
            var q = other.columns;
            var result = new this.constructor[Symbol.species](m * p, n * q);
            for (var i2 = 0; i2 < m; i2++) {
              for (var j = 0; j < n; j++) {
                for (var k = 0; k < p; k++) {
                  for (var l = 0; l < q; l++) {
                    result[p * i2 + k][q * j + l] = this.get(i2, j) * other.get(k, l);
                  }
                }
              }
            }
            return result;
          }
          /**
               * Transposes the matrix and returns a new one containing the result
               * @return {Matrix}
               */
          transpose() {
            var result = new this.constructor[Symbol.species](this.columns, this.rows);
            for (var i2 = 0; i2 < this.rows; i2++) {
              for (var j = 0; j < this.columns; j++) {
                result.set(j, i2, this.get(i2, j));
              }
            }
            return result;
          }
          /**
               * Sorts the rows (in place)
               * @param {function} compareFunction - usual Array.prototype.sort comparison function
               * @return {Matrix} this
               */
          sortRows(compareFunction) {
            if (compareFunction === void 0) compareFunction = compareNumbers;
            for (var i2 = 0; i2 < this.rows; i2++) {
              this.setRow(i2, this.getRow(i2).sort(compareFunction));
            }
            return this;
          }
          /**
               * Sorts the columns (in place)
               * @param {function} compareFunction - usual Array.prototype.sort comparison function
               * @return {Matrix} this
               */
          sortColumns(compareFunction) {
            if (compareFunction === void 0) compareFunction = compareNumbers;
            for (var i2 = 0; i2 < this.columns; i2++) {
              this.setColumn(i2, this.getColumn(i2).sort(compareFunction));
            }
            return this;
          }
          /**
               * Returns a subset of the matrix
               * @param {number} startRow - First row index
               * @param {number} endRow - Last row index
               * @param {number} startColumn - First column index
               * @param {number} endColumn - Last column index
               * @return {Matrix}
               */
          subMatrix(startRow, endRow, startColumn, endColumn) {
            checkRange(this, startRow, endRow, startColumn, endColumn);
            var newMatrix = new this.constructor[Symbol.species](endRow - startRow + 1, endColumn - startColumn + 1);
            for (var i2 = startRow; i2 <= endRow; i2++) {
              for (var j = startColumn; j <= endColumn; j++) {
                newMatrix[i2 - startRow][j - startColumn] = this.get(i2, j);
              }
            }
            return newMatrix;
          }
          /**
               * Returns a subset of the matrix based on an array of row indices
               * @param {Array} indices - Array containing the row indices
               * @param {number} [startColumn = 0] - First column index
               * @param {number} [endColumn = this.columns-1] - Last column index
               * @return {Matrix}
               */
          subMatrixRow(indices, startColumn, endColumn) {
            if (startColumn === void 0) startColumn = 0;
            if (endColumn === void 0) endColumn = this.columns - 1;
            if (startColumn > endColumn || startColumn < 0 || startColumn >= this.columns || endColumn < 0 || endColumn >= this.columns) {
              throw new RangeError("Argument out of range");
            }
            var newMatrix = new this.constructor[Symbol.species](indices.length, endColumn - startColumn + 1);
            for (var i2 = 0; i2 < indices.length; i2++) {
              for (var j = startColumn; j <= endColumn; j++) {
                if (indices[i2] < 0 || indices[i2] >= this.rows) {
                  throw new RangeError(`Row index out of range: ${indices[i2]}`);
                }
                newMatrix.set(i2, j - startColumn, this.get(indices[i2], j));
              }
            }
            return newMatrix;
          }
          /**
               * Returns a subset of the matrix based on an array of column indices
               * @param {Array} indices - Array containing the column indices
               * @param {number} [startRow = 0] - First row index
               * @param {number} [endRow = this.rows-1] - Last row index
               * @return {Matrix}
               */
          subMatrixColumn(indices, startRow, endRow) {
            if (startRow === void 0) startRow = 0;
            if (endRow === void 0) endRow = this.rows - 1;
            if (startRow > endRow || startRow < 0 || startRow >= this.rows || endRow < 0 || endRow >= this.rows) {
              throw new RangeError("Argument out of range");
            }
            var newMatrix = new this.constructor[Symbol.species](endRow - startRow + 1, indices.length);
            for (var i2 = 0; i2 < indices.length; i2++) {
              for (var j = startRow; j <= endRow; j++) {
                if (indices[i2] < 0 || indices[i2] >= this.columns) {
                  throw new RangeError(`Column index out of range: ${indices[i2]}`);
                }
                newMatrix.set(j - startRow, i2, this.get(j, indices[i2]));
              }
            }
            return newMatrix;
          }
          /**
               * Set a part of the matrix to the given sub-matrix
               * @param {Matrix|Array< Array >} matrix - The source matrix from which to extract values.
               * @param {number} startRow - The index of the first row to set
               * @param {number} startColumn - The index of the first column to set
               * @return {Matrix}
               */
          setSubMatrix(matrix2, startRow, startColumn) {
            matrix2 = this.constructor.checkMatrix(matrix2);
            var endRow = startRow + matrix2.rows - 1;
            var endColumn = startColumn + matrix2.columns - 1;
            checkRange(this, startRow, endRow, startColumn, endColumn);
            for (var i2 = 0; i2 < matrix2.rows; i2++) {
              for (var j = 0; j < matrix2.columns; j++) {
                this[startRow + i2][startColumn + j] = matrix2.get(i2, j);
              }
            }
            return this;
          }
          /**
               * Return a new matrix based on a selection of rows and columns
               * @param {Array<number>} rowIndices - The row indices to select. Order matters and an index can be more than once.
               * @param {Array<number>} columnIndices - The column indices to select. Order matters and an index can be use more than once.
               * @return {Matrix} The new matrix
               */
          selection(rowIndices, columnIndices) {
            var indices = checkIndices(this, rowIndices, columnIndices);
            var newMatrix = new this.constructor[Symbol.species](rowIndices.length, columnIndices.length);
            for (var i2 = 0; i2 < indices.row.length; i2++) {
              var rowIndex = indices.row[i2];
              for (var j = 0; j < indices.column.length; j++) {
                var columnIndex = indices.column[j];
                newMatrix[i2][j] = this.get(rowIndex, columnIndex);
              }
            }
            return newMatrix;
          }
          /**
               * Returns the trace of the matrix (sum of the diagonal elements)
               * @return {number}
               */
          trace() {
            var min = Math.min(this.rows, this.columns);
            var trace = 0;
            for (var i2 = 0; i2 < min; i2++) {
              trace += this.get(i2, i2);
            }
            return trace;
          }
          /*
               Matrix views
               */
          /**
               * Returns a view of the transposition of the matrix
               * @return {MatrixTransposeView}
               */
          transposeView() {
            return new MatrixTransposeView3(this);
          }
          /**
               * Returns a view of the row vector with the given index
               * @param {number} row - row index of the vector
               * @return {MatrixRowView}
               */
          rowView(row) {
            checkRowIndex(this, row);
            return new MatrixRowView2(this, row);
          }
          /**
               * Returns a view of the column vector with the given index
               * @param {number} column - column index of the vector
               * @return {MatrixColumnView}
               */
          columnView(column) {
            checkColumnIndex(this, column);
            return new MatrixColumnView2(this, column);
          }
          /**
               * Returns a view of the matrix flipped in the row axis
               * @return {MatrixFlipRowView}
               */
          flipRowView() {
            return new MatrixFlipRowView2(this);
          }
          /**
               * Returns a view of the matrix flipped in the column axis
               * @return {MatrixFlipColumnView}
               */
          flipColumnView() {
            return new MatrixFlipColumnView2(this);
          }
          /**
               * Returns a view of a submatrix giving the index boundaries
               * @param {number} startRow - first row index of the submatrix
               * @param {number} endRow - last row index of the submatrix
               * @param {number} startColumn - first column index of the submatrix
               * @param {number} endColumn - last column index of the submatrix
               * @return {MatrixSubView}
               */
          subMatrixView(startRow, endRow, startColumn, endColumn) {
            return new MatrixSubView2(this, startRow, endRow, startColumn, endColumn);
          }
          /**
               * Returns a view of the cross of the row indices and the column indices
               * @example
               * // resulting vector is [[2], [2]]
               * var matrix = new Matrix([[1,2,3], [4,5,6]]).selectionView([0, 0], [1])
               * @param {Array<number>} rowIndices
               * @param {Array<number>} columnIndices
               * @return {MatrixSelectionView}
               */
          selectionView(rowIndices, columnIndices) {
            return new MatrixSelectionView2(this, rowIndices, columnIndices);
          }
          /**
               * Returns a view of the row indices
               * @example
               * // resulting vector is [[1,2,3], [1,2,3]]
               * var matrix = new Matrix([[1,2,3], [4,5,6]]).rowSelectionView([0, 0])
               * @param {Array<number>} rowIndices
               * @return {MatrixRowSelectionView}
               */
          rowSelectionView(rowIndices) {
            return new MatrixRowSelectionView2(this, rowIndices);
          }
          /**
               * Returns a view of the column indices
               * @example
               * // resulting vector is [[2, 2], [5, 5]]
               * var matrix = new Matrix([[1,2,3], [4,5,6]]).columnSelectionView([1, 1])
               * @param {Array<number>} columnIndices
               * @return {MatrixColumnSelectionView}
               */
          columnSelectionView(columnIndices) {
            return new MatrixColumnSelectionView3(this, columnIndices);
          }
          /**
              * Calculates and returns the determinant of a matrix as a Number
              * @example
              *   new Matrix([[1,2,3], [4,5,6]]).det()
              * @return {number}
              */
          det() {
            if (this.isSquare()) {
              var a, b, c, d;
              if (this.columns === 2) {
                a = this.get(0, 0);
                b = this.get(0, 1);
                c = this.get(1, 0);
                d = this.get(1, 1);
                return a * d - b * c;
              } else if (this.columns === 3) {
                var subMatrix0, subMatrix1, subMatrix2;
                subMatrix0 = this.selectionView([1, 2], [1, 2]);
                subMatrix1 = this.selectionView([1, 2], [0, 2]);
                subMatrix2 = this.selectionView([1, 2], [0, 1]);
                a = this.get(0, 0);
                b = this.get(0, 1);
                c = this.get(0, 2);
                return a * subMatrix0.det() - b * subMatrix1.det() + c * subMatrix2.det();
              } else {
                return new LuDecomposition2(this).determinant;
              }
            } else {
              throw Error("Determinant can only be calculated for a square matrix.");
            }
          }
          /**
               * Returns inverse of a matrix if it exists or the pseudoinverse
               * @param {number} threshold - threshold for taking inverse of singular values (default = 1e-15)
               * @return {Matrix} the (pseudo)inverted matrix.
               */
          pseudoInverse(threshold) {
            if (threshold === void 0) threshold = Number.EPSILON;
            var svdSolution = new SingularValueDecomposition2(this, { autoTranspose: true });
            var U = svdSolution.leftSingularVectors;
            var V = svdSolution.rightSingularVectors;
            var s = svdSolution.diagonal;
            for (var i2 = 0; i2 < s.length; i2++) {
              if (Math.abs(s[i2]) > threshold) {
                s[i2] = 1 / s[i2];
              } else {
                s[i2] = 0;
              }
            }
            s = this.constructor[Symbol.species].diag(s);
            return V.mmul(s.mmul(U.transposeView()));
          }
          /**
               * Creates an exact and independent copy of the matrix
               * @return {Matrix}
               */
          clone() {
            var newMatrix = new this.constructor[Symbol.species](this.rows, this.columns);
            for (var row = 0; row < this.rows; row++) {
              for (var column = 0; column < this.columns; column++) {
                newMatrix.set(row, column, this.get(row, column));
              }
            }
            return newMatrix;
          }
        }
        Matrix4.prototype.klass = "Matrix";
        function compareNumbers(a, b) {
          return a - b;
        }
        Matrix4.random = Matrix4.rand;
        Matrix4.diagonal = Matrix4.diag;
        Matrix4.prototype.diagonal = Matrix4.prototype.diag;
        Matrix4.identity = Matrix4.eye;
        Matrix4.prototype.negate = Matrix4.prototype.neg;
        Matrix4.prototype.tensorProduct = Matrix4.prototype.kroneckerProduct;
        Matrix4.prototype.determinant = Matrix4.prototype.det;
        var inplaceOperator = `
(function %name%(value) {
    if (typeof value === 'number') return this.%name%S(value);
    return this.%name%M(value);
})
`;
        var inplaceOperatorScalar = `
(function %name%S(value) {
    for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.columns; j++) {
            this.set(i, j, this.get(i, j) %op% value);
        }
    }
    return this;
})
`;
        var inplaceOperatorMatrix = `
(function %name%M(matrix) {
    matrix = this.constructor.checkMatrix(matrix);
    if (this.rows !== matrix.rows ||
        this.columns !== matrix.columns) {
        throw new RangeError('Matrices dimensions must be equal');
    }
    for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.columns; j++) {
            this.set(i, j, this.get(i, j) %op% matrix.get(i, j));
        }
    }
    return this;
})
`;
        var staticOperator = `
(function %name%(matrix, value) {
    var newMatrix = new this[Symbol.species](matrix);
    return newMatrix.%name%(value);
})
`;
        var inplaceMethod = `
(function %name%() {
    for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.columns; j++) {
            this.set(i, j, %method%(this.get(i, j)));
        }
    }
    return this;
})
`;
        var staticMethod = `
(function %name%(matrix) {
    var newMatrix = new this[Symbol.species](matrix);
    return newMatrix.%name%();
})
`;
        var inplaceMethodWithArgs = `
(function %name%(%args%) {
    for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.columns; j++) {
            this.set(i, j, %method%(this.get(i, j), %args%));
        }
    }
    return this;
})
`;
        var staticMethodWithArgs = `
(function %name%(matrix, %args%) {
    var newMatrix = new this[Symbol.species](matrix);
    return newMatrix.%name%(%args%);
})
`;
        var inplaceMethodWithOneArgScalar = `
(function %name%S(value) {
    for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.columns; j++) {
            this.set(i, j, %method%(this.get(i, j), value));
        }
    }
    return this;
})
`;
        var inplaceMethodWithOneArgMatrix = `
(function %name%M(matrix) {
    matrix = this.constructor.checkMatrix(matrix);
    if (this.rows !== matrix.rows ||
        this.columns !== matrix.columns) {
        throw new RangeError('Matrices dimensions must be equal');
    }
    for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.columns; j++) {
            this.set(i, j, %method%(this.get(i, j), matrix.get(i, j)));
        }
    }
    return this;
})
`;
        var inplaceMethodWithOneArg = `
(function %name%(value) {
    if (typeof value === 'number') return this.%name%S(value);
    return this.%name%M(value);
})
`;
        var staticMethodWithOneArg = staticMethodWithArgs;
        var operators = [
          // Arithmetic operators
          ["+", "add"],
          ["-", "sub", "subtract"],
          ["*", "mul", "multiply"],
          ["/", "div", "divide"],
          ["%", "mod", "modulus"],
          // Bitwise operators
          ["&", "and"],
          ["|", "or"],
          ["^", "xor"],
          ["<<", "leftShift"],
          [">>", "signPropagatingRightShift"],
          [">>>", "rightShift", "zeroFillRightShift"]
        ];
        var i;
        var eval2 = eval;
        for (var operator of operators) {
          var inplaceOp = eval2(fillTemplateFunction(inplaceOperator, { name: operator[1], op: operator[0] }));
          var inplaceOpS = eval2(fillTemplateFunction(inplaceOperatorScalar, { name: `${operator[1]}S`, op: operator[0] }));
          var inplaceOpM = eval2(fillTemplateFunction(inplaceOperatorMatrix, { name: `${operator[1]}M`, op: operator[0] }));
          var staticOp = eval2(fillTemplateFunction(staticOperator, { name: operator[1] }));
          for (i = 1; i < operator.length; i++) {
            Matrix4.prototype[operator[i]] = inplaceOp;
            Matrix4.prototype[`${operator[i]}S`] = inplaceOpS;
            Matrix4.prototype[`${operator[i]}M`] = inplaceOpM;
            Matrix4[operator[i]] = staticOp;
          }
        }
        var methods = [["~", "not"]];
        [
          "abs",
          "acos",
          "acosh",
          "asin",
          "asinh",
          "atan",
          "atanh",
          "cbrt",
          "ceil",
          "clz32",
          "cos",
          "cosh",
          "exp",
          "expm1",
          "floor",
          "fround",
          "log",
          "log1p",
          "log10",
          "log2",
          "round",
          "sign",
          "sin",
          "sinh",
          "sqrt",
          "tan",
          "tanh",
          "trunc"
        ].forEach(function(mathMethod) {
          methods.push([`Math.${mathMethod}`, mathMethod]);
        });
        for (var method of methods) {
          var inplaceMeth = eval2(fillTemplateFunction(inplaceMethod, { name: method[1], method: method[0] }));
          var staticMeth = eval2(fillTemplateFunction(staticMethod, { name: method[1] }));
          for (i = 1; i < method.length; i++) {
            Matrix4.prototype[method[i]] = inplaceMeth;
            Matrix4[method[i]] = staticMeth;
          }
        }
        var methodsWithArgs = [["Math.pow", 1, "pow"]];
        for (var methodWithArg of methodsWithArgs) {
          var args = "arg0";
          for (i = 1; i < methodWithArg[1]; i++) {
            args += `, arg${i}`;
          }
          if (methodWithArg[1] !== 1) {
            var inplaceMethWithArgs = eval2(fillTemplateFunction(inplaceMethodWithArgs, {
              name: methodWithArg[2],
              method: methodWithArg[0],
              args
            }));
            var staticMethWithArgs = eval2(fillTemplateFunction(staticMethodWithArgs, { name: methodWithArg[2], args }));
            for (i = 2; i < methodWithArg.length; i++) {
              Matrix4.prototype[methodWithArg[i]] = inplaceMethWithArgs;
              Matrix4[methodWithArg[i]] = staticMethWithArgs;
            }
          } else {
            var tmplVar = {
              name: methodWithArg[2],
              args,
              method: methodWithArg[0]
            };
            var inplaceMethod2 = eval2(fillTemplateFunction(inplaceMethodWithOneArg, tmplVar));
            var inplaceMethodS = eval2(fillTemplateFunction(inplaceMethodWithOneArgScalar, tmplVar));
            var inplaceMethodM = eval2(fillTemplateFunction(inplaceMethodWithOneArgMatrix, tmplVar));
            var staticMethod2 = eval2(fillTemplateFunction(staticMethodWithOneArg, tmplVar));
            for (i = 2; i < methodWithArg.length; i++) {
              Matrix4.prototype[methodWithArg[i]] = inplaceMethod2;
              Matrix4.prototype[`${methodWithArg[i]}M`] = inplaceMethodM;
              Matrix4.prototype[`${methodWithArg[i]}S`] = inplaceMethodS;
              Matrix4[methodWithArg[i]] = staticMethod2;
            }
          }
        }
        function fillTemplateFunction(template, values) {
          for (var value in values) {
            template = template.replace(new RegExp(`%${value}%`, "g"), values[value]);
          }
          return template;
        }
        return Matrix4;
      }
      var Matrix3 = class _Matrix extends AbstractMatrix2(Array) {
        constructor(nRows, nColumns) {
          var i;
          if (arguments.length === 1 && typeof nRows === "number") {
            return new Array(nRows);
          }
          if (_Matrix.isMatrix(nRows)) {
            return nRows.clone();
          } else if (Number.isInteger(nRows) && nRows > 0) {
            super(nRows);
            if (Number.isInteger(nColumns) && nColumns > 0) {
              for (i = 0; i < nRows; i++) {
                this[i] = new Array(nColumns);
              }
            } else {
              throw new TypeError("nColumns must be a positive integer");
            }
          } else if (Array.isArray(nRows)) {
            const matrix2 = nRows;
            nRows = matrix2.length;
            nColumns = matrix2[0].length;
            if (typeof nColumns !== "number" || nColumns === 0) {
              throw new TypeError(
                "Data must be a 2D array with at least one element"
              );
            }
            super(nRows);
            for (i = 0; i < nRows; i++) {
              if (matrix2[i].length !== nColumns) {
                throw new RangeError("Inconsistent array dimensions");
              }
              this[i] = [].concat(matrix2[i]);
            }
          } else {
            throw new TypeError(
              "First argument must be a positive number or an array"
            );
          }
          this.rows = nRows;
          this.columns = nColumns;
          return this;
        }
        set(rowIndex, columnIndex, value) {
          this[rowIndex][columnIndex] = value;
          return this;
        }
        get(rowIndex, columnIndex) {
          return this[rowIndex][columnIndex];
        }
        /**
         * Removes a row from the given index
         * @param {number} index - Row index
         * @return {Matrix} this
         */
        removeRow(index) {
          checkRowIndex(this, index);
          if (this.rows === 1) {
            throw new RangeError("A matrix cannot have less than one row");
          }
          this.splice(index, 1);
          this.rows -= 1;
          return this;
        }
        /**
         * Adds a row at the given index
         * @param {number} [index = this.rows] - Row index
         * @param {Array|Matrix} array - Array or vector
         * @return {Matrix} this
         */
        addRow(index, array) {
          if (array === void 0) {
            array = index;
            index = this.rows;
          }
          checkRowIndex(this, index, true);
          array = checkRowVector(this, array, true);
          this.splice(index, 0, array);
          this.rows += 1;
          return this;
        }
        /**
         * Removes a column from the given index
         * @param {number} index - Column index
         * @return {Matrix} this
         */
        removeColumn(index) {
          checkColumnIndex(this, index);
          if (this.columns === 1) {
            throw new RangeError("A matrix cannot have less than one column");
          }
          for (var i = 0; i < this.rows; i++) {
            this[i].splice(index, 1);
          }
          this.columns -= 1;
          return this;
        }
        /**
         * Adds a column at the given index
         * @param {number} [index = this.columns] - Column index
         * @param {Array|Matrix} array - Array or vector
         * @return {Matrix} this
         */
        addColumn(index, array) {
          if (typeof array === "undefined") {
            array = index;
            index = this.columns;
          }
          checkColumnIndex(this, index, true);
          array = checkColumnVector(this, array);
          for (var i = 0; i < this.rows; i++) {
            this[i].splice(index, 0, array[i]);
          }
          this.columns += 1;
          return this;
        }
      };
      var WrapperMatrix1D2 = class extends AbstractMatrix2() {
        /**
         * @class WrapperMatrix1D
         * @param {Array<number>} data
         * @param {object} [options]
         * @param {object} [options.rows = 1]
         */
        constructor(data, options = {}) {
          const { rows = 1 } = options;
          if (data.length % rows !== 0) {
            throw new Error("the data length is not divisible by the number of rows");
          }
          super();
          this.rows = rows;
          this.columns = data.length / rows;
          this.data = data;
        }
        set(rowIndex, columnIndex, value) {
          var index = this._calculateIndex(rowIndex, columnIndex);
          this.data[index] = value;
          return this;
        }
        get(rowIndex, columnIndex) {
          var index = this._calculateIndex(rowIndex, columnIndex);
          return this.data[index];
        }
        _calculateIndex(row, column) {
          return row * this.columns + column;
        }
        static get [Symbol.species]() {
          return Matrix3;
        }
      };
      var WrapperMatrix2D3 = class extends AbstractMatrix2() {
        /**
         * @class WrapperMatrix2D
         * @param {Array<Array<number>>} data
         */
        constructor(data) {
          super();
          this.data = data;
          this.rows = data.length;
          this.columns = data[0].length;
        }
        set(rowIndex, columnIndex, value) {
          this.data[rowIndex][columnIndex] = value;
          return this;
        }
        get(rowIndex, columnIndex) {
          return this.data[rowIndex][columnIndex];
        }
        static get [Symbol.species]() {
          return Matrix3;
        }
      };
      function wrap2(array, options) {
        if (Array.isArray(array)) {
          if (array[0] && Array.isArray(array[0])) {
            return new WrapperMatrix2D3(array);
          } else {
            return new WrapperMatrix1D2(array, options);
          }
        } else {
          throw new Error("the argument is not an array");
        }
      }
      var QrDecomposition2 = class {
        constructor(value) {
          value = WrapperMatrix2D3.checkMatrix(value);
          var qr = value.clone();
          var m = value.rows;
          var n = value.columns;
          var rdiag = new Array(n);
          var i, j, k, s;
          for (k = 0; k < n; k++) {
            var nrm = 0;
            for (i = k; i < m; i++) {
              nrm = hypotenuse(nrm, qr.get(i, k));
            }
            if (nrm !== 0) {
              if (qr.get(k, k) < 0) {
                nrm = -nrm;
              }
              for (i = k; i < m; i++) {
                qr.set(i, k, qr.get(i, k) / nrm);
              }
              qr.set(k, k, qr.get(k, k) + 1);
              for (j = k + 1; j < n; j++) {
                s = 0;
                for (i = k; i < m; i++) {
                  s += qr.get(i, k) * qr.get(i, j);
                }
                s = -s / qr.get(k, k);
                for (i = k; i < m; i++) {
                  qr.set(i, j, qr.get(i, j) + s * qr.get(i, k));
                }
              }
            }
            rdiag[k] = -nrm;
          }
          this.QR = qr;
          this.Rdiag = rdiag;
        }
        /**
         * Solve a problem of least square (Ax=b) by using the QR decomposition. Useful when A is rectangular, but not working when A is singular.
         * Example : We search to approximate x, with A matrix shape m*n, x vector size n, b vector size m (m > n). We will use :
         * var qr = QrDecomposition(A);
         * var x = qr.solve(b);
         * @param {Matrix} value - Matrix 1D which is the vector b (in the equation Ax = b)
         * @return {Matrix} - The vector x
         */
        solve(value) {
          value = Matrix3.checkMatrix(value);
          var qr = this.QR;
          var m = qr.rows;
          if (value.rows !== m) {
            throw new Error("Matrix row dimensions must agree");
          }
          if (!this.isFullRank()) {
            throw new Error("Matrix is rank deficient");
          }
          var count = value.columns;
          var X = value.clone();
          var n = qr.columns;
          var i, j, k, s;
          for (k = 0; k < n; k++) {
            for (j = 0; j < count; j++) {
              s = 0;
              for (i = k; i < m; i++) {
                s += qr[i][k] * X[i][j];
              }
              s = -s / qr[k][k];
              for (i = k; i < m; i++) {
                X[i][j] += s * qr[i][k];
              }
            }
          }
          for (k = n - 1; k >= 0; k--) {
            for (j = 0; j < count; j++) {
              X[k][j] /= this.Rdiag[k];
            }
            for (i = 0; i < k; i++) {
              for (j = 0; j < count; j++) {
                X[i][j] -= X[k][j] * qr[i][k];
              }
            }
          }
          return X.subMatrix(0, n - 1, 0, count - 1);
        }
        /**
         *
         * @return {boolean}
         */
        isFullRank() {
          var columns = this.QR.columns;
          for (var i = 0; i < columns; i++) {
            if (this.Rdiag[i] === 0) {
              return false;
            }
          }
          return true;
        }
        /**
         *
         * @return {Matrix}
         */
        get upperTriangularMatrix() {
          var qr = this.QR;
          var n = qr.columns;
          var X = new Matrix3(n, n);
          var i, j;
          for (i = 0; i < n; i++) {
            for (j = 0; j < n; j++) {
              if (i < j) {
                X[i][j] = qr[i][j];
              } else if (i === j) {
                X[i][j] = this.Rdiag[i];
              } else {
                X[i][j] = 0;
              }
            }
          }
          return X;
        }
        /**
         *
         * @return {Matrix}
         */
        get orthogonalMatrix() {
          var qr = this.QR;
          var rows = qr.rows;
          var columns = qr.columns;
          var X = new Matrix3(rows, columns);
          var i, j, k, s;
          for (k = columns - 1; k >= 0; k--) {
            for (i = 0; i < rows; i++) {
              X[i][k] = 0;
            }
            X[k][k] = 1;
            for (j = k; j < columns; j++) {
              if (qr[k][k] !== 0) {
                s = 0;
                for (i = k; i < rows; i++) {
                  s += qr[i][k] * X[i][j];
                }
                s = -s / qr[k][k];
                for (i = k; i < rows; i++) {
                  X[i][j] += s * qr[i][k];
                }
              }
            }
          }
          return X;
        }
      };
      function inverse2(matrix2, useSVD = false) {
        matrix2 = WrapperMatrix2D3.checkMatrix(matrix2);
        if (useSVD) {
          return new SingularValueDecomposition2(matrix2).inverse();
        } else {
          return solve2(matrix2, Matrix3.eye(matrix2.rows));
        }
      }
      function solve2(leftHandSide, rightHandSide, useSVD = false) {
        leftHandSide = WrapperMatrix2D3.checkMatrix(leftHandSide);
        rightHandSide = WrapperMatrix2D3.checkMatrix(rightHandSide);
        if (useSVD) {
          return new SingularValueDecomposition2(leftHandSide).solve(rightHandSide);
        } else {
          return leftHandSide.isSquare() ? new LuDecomposition2(leftHandSide).solve(rightHandSide) : new QrDecomposition2(leftHandSide).solve(rightHandSide);
        }
      }
      function xrange(n, exception) {
        var range = [];
        for (var i = 0; i < n; i++) {
          if (i !== exception) {
            range.push(i);
          }
        }
        return range;
      }
      function dependenciesOneRow(error, matrix2, index, thresholdValue = 1e-9, thresholdError = 1e-9) {
        if (error > thresholdError) {
          return new Array(matrix2.rows + 1).fill(0);
        } else {
          var returnArray = matrix2.addRow(index, [0]);
          for (var i = 0; i < returnArray.rows; i++) {
            if (Math.abs(returnArray.get(i, 0)) < thresholdValue) {
              returnArray.set(i, 0, 0);
            }
          }
          return returnArray.to1DArray();
        }
      }
      function linearDependencies2(matrix2, options = {}) {
        const { thresholdValue = 1e-9, thresholdError = 1e-9 } = options;
        var n = matrix2.rows;
        var results = new Matrix3(n, n);
        for (var i = 0; i < n; i++) {
          var b = Matrix3.columnVector(matrix2.getRow(i));
          var Abis = matrix2.subMatrixRow(xrange(n, i)).transposeView();
          var svd = new SingularValueDecomposition2(Abis);
          var x = svd.solve(b);
          var error = max(
            Matrix3.sub(b, Abis.mmul(x)).abs().to1DArray()
          );
          results.setRow(
            i,
            dependenciesOneRow(error, x, i, thresholdValue, thresholdError)
          );
        }
        return results;
      }
      var EigenvalueDecomposition2 = class {
        constructor(matrix2, options = {}) {
          const { assumeSymmetric = false } = options;
          matrix2 = WrapperMatrix2D3.checkMatrix(matrix2);
          if (!matrix2.isSquare()) {
            throw new Error("Matrix is not a square matrix");
          }
          var n = matrix2.columns;
          var V = getFilled2DArray(n, n, 0);
          var d = new Array(n);
          var e = new Array(n);
          var value = matrix2;
          var i, j;
          var isSymmetric = false;
          if (assumeSymmetric) {
            isSymmetric = true;
          } else {
            isSymmetric = matrix2.isSymmetric();
          }
          if (isSymmetric) {
            for (i = 0; i < n; i++) {
              for (j = 0; j < n; j++) {
                V[i][j] = value.get(i, j);
              }
            }
            tred2(n, e, d, V);
            tql2(n, e, d, V);
          } else {
            var H = getFilled2DArray(n, n, 0);
            var ort = new Array(n);
            for (j = 0; j < n; j++) {
              for (i = 0; i < n; i++) {
                H[i][j] = value.get(i, j);
              }
            }
            orthes(n, H, ort, V);
            hqr2(n, e, d, V, H);
          }
          this.n = n;
          this.e = e;
          this.d = d;
          this.V = V;
        }
        /**
         *
         * @return {Array<number>}
         */
        get realEigenvalues() {
          return this.d;
        }
        /**
         *
         * @return {Array<number>}
         */
        get imaginaryEigenvalues() {
          return this.e;
        }
        /**
         *
         * @return {Matrix}
         */
        get eigenvectorMatrix() {
          if (!Matrix3.isMatrix(this.V)) {
            this.V = new Matrix3(this.V);
          }
          return this.V;
        }
        /**
         *
         * @return {Matrix}
         */
        get diagonalMatrix() {
          var n = this.n;
          var e = this.e;
          var d = this.d;
          var X = new Matrix3(n, n);
          var i, j;
          for (i = 0; i < n; i++) {
            for (j = 0; j < n; j++) {
              X[i][j] = 0;
            }
            X[i][i] = d[i];
            if (e[i] > 0) {
              X[i][i + 1] = e[i];
            } else if (e[i] < 0) {
              X[i][i - 1] = e[i];
            }
          }
          return X;
        }
      };
      function tred2(n, e, d, V) {
        var f, g, h, i, j, k, hh, scale;
        for (j = 0; j < n; j++) {
          d[j] = V[n - 1][j];
        }
        for (i = n - 1; i > 0; i--) {
          scale = 0;
          h = 0;
          for (k = 0; k < i; k++) {
            scale = scale + Math.abs(d[k]);
          }
          if (scale === 0) {
            e[i] = d[i - 1];
            for (j = 0; j < i; j++) {
              d[j] = V[i - 1][j];
              V[i][j] = 0;
              V[j][i] = 0;
            }
          } else {
            for (k = 0; k < i; k++) {
              d[k] /= scale;
              h += d[k] * d[k];
            }
            f = d[i - 1];
            g = Math.sqrt(h);
            if (f > 0) {
              g = -g;
            }
            e[i] = scale * g;
            h = h - f * g;
            d[i - 1] = f - g;
            for (j = 0; j < i; j++) {
              e[j] = 0;
            }
            for (j = 0; j < i; j++) {
              f = d[j];
              V[j][i] = f;
              g = e[j] + V[j][j] * f;
              for (k = j + 1; k <= i - 1; k++) {
                g += V[k][j] * d[k];
                e[k] += V[k][j] * f;
              }
              e[j] = g;
            }
            f = 0;
            for (j = 0; j < i; j++) {
              e[j] /= h;
              f += e[j] * d[j];
            }
            hh = f / (h + h);
            for (j = 0; j < i; j++) {
              e[j] -= hh * d[j];
            }
            for (j = 0; j < i; j++) {
              f = d[j];
              g = e[j];
              for (k = j; k <= i - 1; k++) {
                V[k][j] -= f * e[k] + g * d[k];
              }
              d[j] = V[i - 1][j];
              V[i][j] = 0;
            }
          }
          d[i] = h;
        }
        for (i = 0; i < n - 1; i++) {
          V[n - 1][i] = V[i][i];
          V[i][i] = 1;
          h = d[i + 1];
          if (h !== 0) {
            for (k = 0; k <= i; k++) {
              d[k] = V[k][i + 1] / h;
            }
            for (j = 0; j <= i; j++) {
              g = 0;
              for (k = 0; k <= i; k++) {
                g += V[k][i + 1] * V[k][j];
              }
              for (k = 0; k <= i; k++) {
                V[k][j] -= g * d[k];
              }
            }
          }
          for (k = 0; k <= i; k++) {
            V[k][i + 1] = 0;
          }
        }
        for (j = 0; j < n; j++) {
          d[j] = V[n - 1][j];
          V[n - 1][j] = 0;
        }
        V[n - 1][n - 1] = 1;
        e[0] = 0;
      }
      function tql2(n, e, d, V) {
        var g, h, i, j, k, l, m, p, r, dl1, c, c2, c3, el1, s, s2;
        for (i = 1; i < n; i++) {
          e[i - 1] = e[i];
        }
        e[n - 1] = 0;
        var f = 0;
        var tst1 = 0;
        var eps = Number.EPSILON;
        for (l = 0; l < n; l++) {
          tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
          m = l;
          while (m < n) {
            if (Math.abs(e[m]) <= eps * tst1) {
              break;
            }
            m++;
          }
          if (m > l) {
            do {
              g = d[l];
              p = (d[l + 1] - g) / (2 * e[l]);
              r = hypotenuse(p, 1);
              if (p < 0) {
                r = -r;
              }
              d[l] = e[l] / (p + r);
              d[l + 1] = e[l] * (p + r);
              dl1 = d[l + 1];
              h = g - d[l];
              for (i = l + 2; i < n; i++) {
                d[i] -= h;
              }
              f = f + h;
              p = d[m];
              c = 1;
              c2 = c;
              c3 = c;
              el1 = e[l + 1];
              s = 0;
              s2 = 0;
              for (i = m - 1; i >= l; i--) {
                c3 = c2;
                c2 = c;
                s2 = s;
                g = c * e[i];
                h = c * p;
                r = hypotenuse(p, e[i]);
                e[i + 1] = s * r;
                s = e[i] / r;
                c = p / r;
                p = c * d[i] - s * g;
                d[i + 1] = h + s * (c * g + s * d[i]);
                for (k = 0; k < n; k++) {
                  h = V[k][i + 1];
                  V[k][i + 1] = s * V[k][i] + c * h;
                  V[k][i] = c * V[k][i] - s * h;
                }
              }
              p = -s * s2 * c3 * el1 * e[l] / dl1;
              e[l] = s * p;
              d[l] = c * p;
            } while (Math.abs(e[l]) > eps * tst1);
          }
          d[l] = d[l] + f;
          e[l] = 0;
        }
        for (i = 0; i < n - 1; i++) {
          k = i;
          p = d[i];
          for (j = i + 1; j < n; j++) {
            if (d[j] < p) {
              k = j;
              p = d[j];
            }
          }
          if (k !== i) {
            d[k] = d[i];
            d[i] = p;
            for (j = 0; j < n; j++) {
              p = V[j][i];
              V[j][i] = V[j][k];
              V[j][k] = p;
            }
          }
        }
      }
      function orthes(n, H, ort, V) {
        var low = 0;
        var high = n - 1;
        var f, g, h, i, j, m;
        var scale;
        for (m = low + 1; m <= high - 1; m++) {
          scale = 0;
          for (i = m; i <= high; i++) {
            scale = scale + Math.abs(H[i][m - 1]);
          }
          if (scale !== 0) {
            h = 0;
            for (i = high; i >= m; i--) {
              ort[i] = H[i][m - 1] / scale;
              h += ort[i] * ort[i];
            }
            g = Math.sqrt(h);
            if (ort[m] > 0) {
              g = -g;
            }
            h = h - ort[m] * g;
            ort[m] = ort[m] - g;
            for (j = m; j < n; j++) {
              f = 0;
              for (i = high; i >= m; i--) {
                f += ort[i] * H[i][j];
              }
              f = f / h;
              for (i = m; i <= high; i++) {
                H[i][j] -= f * ort[i];
              }
            }
            for (i = 0; i <= high; i++) {
              f = 0;
              for (j = high; j >= m; j--) {
                f += ort[j] * H[i][j];
              }
              f = f / h;
              for (j = m; j <= high; j++) {
                H[i][j] -= f * ort[j];
              }
            }
            ort[m] = scale * ort[m];
            H[m][m - 1] = scale * g;
          }
        }
        for (i = 0; i < n; i++) {
          for (j = 0; j < n; j++) {
            V[i][j] = i === j ? 1 : 0;
          }
        }
        for (m = high - 1; m >= low + 1; m--) {
          if (H[m][m - 1] !== 0) {
            for (i = m + 1; i <= high; i++) {
              ort[i] = H[i][m - 1];
            }
            for (j = m; j <= high; j++) {
              g = 0;
              for (i = m; i <= high; i++) {
                g += ort[i] * V[i][j];
              }
              g = g / ort[m] / H[m][m - 1];
              for (i = m; i <= high; i++) {
                V[i][j] += g * ort[i];
              }
            }
          }
        }
      }
      function hqr2(nn, e, d, V, H) {
        var n = nn - 1;
        var low = 0;
        var high = nn - 1;
        var eps = Number.EPSILON;
        var exshift = 0;
        var norm = 0;
        var p = 0;
        var q = 0;
        var r = 0;
        var s = 0;
        var z = 0;
        var iter = 0;
        var i, j, k, l, m, t, w, x, y;
        var ra, sa, vr, vi;
        var notlast, cdivres;
        for (i = 0; i < nn; i++) {
          if (i < low || i > high) {
            d[i] = H[i][i];
            e[i] = 0;
          }
          for (j = Math.max(i - 1, 0); j < nn; j++) {
            norm = norm + Math.abs(H[i][j]);
          }
        }
        while (n >= low) {
          l = n;
          while (l > low) {
            s = Math.abs(H[l - 1][l - 1]) + Math.abs(H[l][l]);
            if (s === 0) {
              s = norm;
            }
            if (Math.abs(H[l][l - 1]) < eps * s) {
              break;
            }
            l--;
          }
          if (l === n) {
            H[n][n] = H[n][n] + exshift;
            d[n] = H[n][n];
            e[n] = 0;
            n--;
            iter = 0;
          } else if (l === n - 1) {
            w = H[n][n - 1] * H[n - 1][n];
            p = (H[n - 1][n - 1] - H[n][n]) / 2;
            q = p * p + w;
            z = Math.sqrt(Math.abs(q));
            H[n][n] = H[n][n] + exshift;
            H[n - 1][n - 1] = H[n - 1][n - 1] + exshift;
            x = H[n][n];
            if (q >= 0) {
              z = p >= 0 ? p + z : p - z;
              d[n - 1] = x + z;
              d[n] = d[n - 1];
              if (z !== 0) {
                d[n] = x - w / z;
              }
              e[n - 1] = 0;
              e[n] = 0;
              x = H[n][n - 1];
              s = Math.abs(x) + Math.abs(z);
              p = x / s;
              q = z / s;
              r = Math.sqrt(p * p + q * q);
              p = p / r;
              q = q / r;
              for (j = n - 1; j < nn; j++) {
                z = H[n - 1][j];
                H[n - 1][j] = q * z + p * H[n][j];
                H[n][j] = q * H[n][j] - p * z;
              }
              for (i = 0; i <= n; i++) {
                z = H[i][n - 1];
                H[i][n - 1] = q * z + p * H[i][n];
                H[i][n] = q * H[i][n] - p * z;
              }
              for (i = low; i <= high; i++) {
                z = V[i][n - 1];
                V[i][n - 1] = q * z + p * V[i][n];
                V[i][n] = q * V[i][n] - p * z;
              }
            } else {
              d[n - 1] = x + p;
              d[n] = x + p;
              e[n - 1] = z;
              e[n] = -z;
            }
            n = n - 2;
            iter = 0;
          } else {
            x = H[n][n];
            y = 0;
            w = 0;
            if (l < n) {
              y = H[n - 1][n - 1];
              w = H[n][n - 1] * H[n - 1][n];
            }
            if (iter === 10) {
              exshift += x;
              for (i = low; i <= n; i++) {
                H[i][i] -= x;
              }
              s = Math.abs(H[n][n - 1]) + Math.abs(H[n - 1][n - 2]);
              x = y = 0.75 * s;
              w = -0.4375 * s * s;
            }
            if (iter === 30) {
              s = (y - x) / 2;
              s = s * s + w;
              if (s > 0) {
                s = Math.sqrt(s);
                if (y < x) {
                  s = -s;
                }
                s = x - w / ((y - x) / 2 + s);
                for (i = low; i <= n; i++) {
                  H[i][i] -= s;
                }
                exshift += s;
                x = y = w = 0.964;
              }
            }
            iter = iter + 1;
            m = n - 2;
            while (m >= l) {
              z = H[m][m];
              r = x - z;
              s = y - z;
              p = (r * s - w) / H[m + 1][m] + H[m][m + 1];
              q = H[m + 1][m + 1] - z - r - s;
              r = H[m + 2][m + 1];
              s = Math.abs(p) + Math.abs(q) + Math.abs(r);
              p = p / s;
              q = q / s;
              r = r / s;
              if (m === l) {
                break;
              }
              if (Math.abs(H[m][m - 1]) * (Math.abs(q) + Math.abs(r)) < eps * (Math.abs(p) * (Math.abs(H[m - 1][m - 1]) + Math.abs(z) + Math.abs(H[m + 1][m + 1])))) {
                break;
              }
              m--;
            }
            for (i = m + 2; i <= n; i++) {
              H[i][i - 2] = 0;
              if (i > m + 2) {
                H[i][i - 3] = 0;
              }
            }
            for (k = m; k <= n - 1; k++) {
              notlast = k !== n - 1;
              if (k !== m) {
                p = H[k][k - 1];
                q = H[k + 1][k - 1];
                r = notlast ? H[k + 2][k - 1] : 0;
                x = Math.abs(p) + Math.abs(q) + Math.abs(r);
                if (x !== 0) {
                  p = p / x;
                  q = q / x;
                  r = r / x;
                }
              }
              if (x === 0) {
                break;
              }
              s = Math.sqrt(p * p + q * q + r * r);
              if (p < 0) {
                s = -s;
              }
              if (s !== 0) {
                if (k !== m) {
                  H[k][k - 1] = -s * x;
                } else if (l !== m) {
                  H[k][k - 1] = -H[k][k - 1];
                }
                p = p + s;
                x = p / s;
                y = q / s;
                z = r / s;
                q = q / p;
                r = r / p;
                for (j = k; j < nn; j++) {
                  p = H[k][j] + q * H[k + 1][j];
                  if (notlast) {
                    p = p + r * H[k + 2][j];
                    H[k + 2][j] = H[k + 2][j] - p * z;
                  }
                  H[k][j] = H[k][j] - p * x;
                  H[k + 1][j] = H[k + 1][j] - p * y;
                }
                for (i = 0; i <= Math.min(n, k + 3); i++) {
                  p = x * H[i][k] + y * H[i][k + 1];
                  if (notlast) {
                    p = p + z * H[i][k + 2];
                    H[i][k + 2] = H[i][k + 2] - p * r;
                  }
                  H[i][k] = H[i][k] - p;
                  H[i][k + 1] = H[i][k + 1] - p * q;
                }
                for (i = low; i <= high; i++) {
                  p = x * V[i][k] + y * V[i][k + 1];
                  if (notlast) {
                    p = p + z * V[i][k + 2];
                    V[i][k + 2] = V[i][k + 2] - p * r;
                  }
                  V[i][k] = V[i][k] - p;
                  V[i][k + 1] = V[i][k + 1] - p * q;
                }
              }
            }
          }
        }
        if (norm === 0) {
          return;
        }
        for (n = nn - 1; n >= 0; n--) {
          p = d[n];
          q = e[n];
          if (q === 0) {
            l = n;
            H[n][n] = 1;
            for (i = n - 1; i >= 0; i--) {
              w = H[i][i] - p;
              r = 0;
              for (j = l; j <= n; j++) {
                r = r + H[i][j] * H[j][n];
              }
              if (e[i] < 0) {
                z = w;
                s = r;
              } else {
                l = i;
                if (e[i] === 0) {
                  H[i][n] = w !== 0 ? -r / w : -r / (eps * norm);
                } else {
                  x = H[i][i + 1];
                  y = H[i + 1][i];
                  q = (d[i] - p) * (d[i] - p) + e[i] * e[i];
                  t = (x * s - z * r) / q;
                  H[i][n] = t;
                  H[i + 1][n] = Math.abs(x) > Math.abs(z) ? (-r - w * t) / x : (-s - y * t) / z;
                }
                t = Math.abs(H[i][n]);
                if (eps * t * t > 1) {
                  for (j = i; j <= n; j++) {
                    H[j][n] = H[j][n] / t;
                  }
                }
              }
            }
          } else if (q < 0) {
            l = n - 1;
            if (Math.abs(H[n][n - 1]) > Math.abs(H[n - 1][n])) {
              H[n - 1][n - 1] = q / H[n][n - 1];
              H[n - 1][n] = -(H[n][n] - p) / H[n][n - 1];
            } else {
              cdivres = cdiv(0, -H[n - 1][n], H[n - 1][n - 1] - p, q);
              H[n - 1][n - 1] = cdivres[0];
              H[n - 1][n] = cdivres[1];
            }
            H[n][n - 1] = 0;
            H[n][n] = 1;
            for (i = n - 2; i >= 0; i--) {
              ra = 0;
              sa = 0;
              for (j = l; j <= n; j++) {
                ra = ra + H[i][j] * H[j][n - 1];
                sa = sa + H[i][j] * H[j][n];
              }
              w = H[i][i] - p;
              if (e[i] < 0) {
                z = w;
                r = ra;
                s = sa;
              } else {
                l = i;
                if (e[i] === 0) {
                  cdivres = cdiv(-ra, -sa, w, q);
                  H[i][n - 1] = cdivres[0];
                  H[i][n] = cdivres[1];
                } else {
                  x = H[i][i + 1];
                  y = H[i + 1][i];
                  vr = (d[i] - p) * (d[i] - p) + e[i] * e[i] - q * q;
                  vi = (d[i] - p) * 2 * q;
                  if (vr === 0 && vi === 0) {
                    vr = eps * norm * (Math.abs(w) + Math.abs(q) + Math.abs(x) + Math.abs(y) + Math.abs(z));
                  }
                  cdivres = cdiv(
                    x * r - z * ra + q * sa,
                    x * s - z * sa - q * ra,
                    vr,
                    vi
                  );
                  H[i][n - 1] = cdivres[0];
                  H[i][n] = cdivres[1];
                  if (Math.abs(x) > Math.abs(z) + Math.abs(q)) {
                    H[i + 1][n - 1] = (-ra - w * H[i][n - 1] + q * H[i][n]) / x;
                    H[i + 1][n] = (-sa - w * H[i][n] - q * H[i][n - 1]) / x;
                  } else {
                    cdivres = cdiv(-r - y * H[i][n - 1], -s - y * H[i][n], z, q);
                    H[i + 1][n - 1] = cdivres[0];
                    H[i + 1][n] = cdivres[1];
                  }
                }
                t = Math.max(Math.abs(H[i][n - 1]), Math.abs(H[i][n]));
                if (eps * t * t > 1) {
                  for (j = i; j <= n; j++) {
                    H[j][n - 1] = H[j][n - 1] / t;
                    H[j][n] = H[j][n] / t;
                  }
                }
              }
            }
          }
        }
        for (i = 0; i < nn; i++) {
          if (i < low || i > high) {
            for (j = i; j < nn; j++) {
              V[i][j] = H[i][j];
            }
          }
        }
        for (j = nn - 1; j >= low; j--) {
          for (i = low; i <= high; i++) {
            z = 0;
            for (k = low; k <= Math.min(j, high); k++) {
              z = z + V[i][k] * H[k][j];
            }
            V[i][j] = z;
          }
        }
      }
      function cdiv(xr, xi, yr, yi) {
        var r, d;
        if (Math.abs(yr) > Math.abs(yi)) {
          r = yi / yr;
          d = yr + r * yi;
          return [(xr + r * xi) / d, (xi - r * xr) / d];
        } else {
          r = yr / yi;
          d = yi + r * yr;
          return [(r * xr + xi) / d, (r * xi - xr) / d];
        }
      }
      var CholeskyDecomposition2 = class {
        constructor(value) {
          value = WrapperMatrix2D3.checkMatrix(value);
          if (!value.isSymmetric()) {
            throw new Error("Matrix is not symmetric");
          }
          var a = value;
          var dimension = a.rows;
          var l = new Matrix3(dimension, dimension);
          var positiveDefinite = true;
          var i, j, k;
          for (j = 0; j < dimension; j++) {
            var Lrowj = l[j];
            var d = 0;
            for (k = 0; k < j; k++) {
              var Lrowk = l[k];
              var s = 0;
              for (i = 0; i < k; i++) {
                s += Lrowk[i] * Lrowj[i];
              }
              Lrowj[k] = s = (a.get(j, k) - s) / l[k][k];
              d = d + s * s;
            }
            d = a.get(j, j) - d;
            positiveDefinite &= d > 0;
            l[j][j] = Math.sqrt(Math.max(d, 0));
            for (k = j + 1; k < dimension; k++) {
              l[j][k] = 0;
            }
          }
          if (!positiveDefinite) {
            throw new Error("Matrix is not positive definite");
          }
          this.L = l;
        }
        /**
         *
         * @param {Matrix} value
         * @return {Matrix}
         */
        solve(value) {
          value = WrapperMatrix2D3.checkMatrix(value);
          var l = this.L;
          var dimension = l.rows;
          if (value.rows !== dimension) {
            throw new Error("Matrix dimensions do not match");
          }
          var count = value.columns;
          var B = value.clone();
          var i, j, k;
          for (k = 0; k < dimension; k++) {
            for (j = 0; j < count; j++) {
              for (i = 0; i < k; i++) {
                B[k][j] -= B[i][j] * l[k][i];
              }
              B[k][j] /= l[k][k];
            }
          }
          for (k = dimension - 1; k >= 0; k--) {
            for (j = 0; j < count; j++) {
              for (i = k + 1; i < dimension; i++) {
                B[k][j] -= B[i][j] * l[i][k];
              }
              B[k][j] /= l[k][k];
            }
          }
          return B;
        }
        /**
         *
         * @return {Matrix}
         */
        get lowerTriangularMatrix() {
          return this.L;
        }
      };
      exports.CHO = CholeskyDecomposition2;
      exports.CholeskyDecomposition = CholeskyDecomposition2;
      exports.EVD = EigenvalueDecomposition2;
      exports.EigenvalueDecomposition = EigenvalueDecomposition2;
      exports.LU = LuDecomposition2;
      exports.LuDecomposition = LuDecomposition2;
      exports.Matrix = Matrix3;
      exports.QR = QrDecomposition2;
      exports.QrDecomposition = QrDecomposition2;
      exports.SVD = SingularValueDecomposition2;
      exports.SingularValueDecomposition = SingularValueDecomposition2;
      exports.WrapperMatrix1D = WrapperMatrix1D2;
      exports.WrapperMatrix2D = WrapperMatrix2D3;
      exports.abstractMatrix = AbstractMatrix2;
      exports.default = Matrix3;
      exports.inverse = inverse2;
      exports.linearDependencies = linearDependencies2;
      exports.solve = solve2;
      exports.wrap = wrap2;
    }
  });

  // node_modules/ml-kernel-gaussian/gaussian-kernel.js
  var require_gaussian_kernel = __commonJS({
    "node_modules/ml-kernel-gaussian/gaussian-kernel.js"(exports, module) {
      "use strict";
      var { squaredEuclidean } = require_euclidean();
      var defaultOptions5 = {
        sigma: 1
      };
      var GaussianKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.sigma = options.sigma;
          this.divisor = 2 * options.sigma * options.sigma;
        }
        compute(x, y) {
          const distance = squaredEuclidean(x, y);
          return Math.exp(-distance / this.divisor);
        }
      };
      module.exports = GaussianKernel;
    }
  });

  // node_modules/ml-kernel-polynomial/polynomial-kernel.js
  var require_polynomial_kernel = __commonJS({
    "node_modules/ml-kernel-polynomial/polynomial-kernel.js"(exports, module) {
      "use strict";
      var defaultOptions5 = {
        degree: 1,
        constant: 1,
        scale: 1
      };
      var PolynomialKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.degree = options.degree;
          this.constant = options.constant;
          this.scale = options.scale;
        }
        compute(x, y) {
          var sum2 = 0;
          for (var i = 0; i < x.length; i++) {
            sum2 += x[i] * y[i];
          }
          return Math.pow(this.scale * sum2 + this.constant, this.degree);
        }
      };
      module.exports = PolynomialKernel;
    }
  });

  // node_modules/ml-svm/node_modules/ml-kernel/src/kernels/anova-kernel.js
  var require_anova_kernel = __commonJS({
    "node_modules/ml-svm/node_modules/ml-kernel/src/kernels/anova-kernel.js"(exports, module) {
      "use strict";
      var defaultOptions5 = {
        sigma: 1,
        degree: 1
      };
      var ANOVAKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.sigma = options.sigma;
          this.degree = options.degree;
        }
        compute(x, y) {
          var sum2 = 0;
          var len = Math.min(x.length, y.length);
          for (var i = 1; i <= len; ++i) {
            sum2 += Math.pow(Math.exp(-this.sigma * Math.pow(Math.pow(x[i - 1], i) - Math.pow(y[i - 1], i), 2)), this.degree);
          }
          return sum2;
        }
      };
      module.exports = ANOVAKernel;
    }
  });

  // node_modules/ml-svm/node_modules/ml-distance-euclidean/euclidean.js
  var require_euclidean2 = __commonJS({
    "node_modules/ml-svm/node_modules/ml-distance-euclidean/euclidean.js"(exports, module) {
      "use strict";
      function squaredEuclidean(p, q) {
        var d = 0;
        for (var i = 0; i < p.length; i++) {
          d += (p[i] - q[i]) * (p[i] - q[i]);
        }
        return d;
      }
      function euclidean(p, q) {
        return Math.sqrt(squaredEuclidean(p, q));
      }
      module.exports = euclidean;
      euclidean.squared = squaredEuclidean;
    }
  });

  // node_modules/ml-svm/node_modules/ml-kernel/src/kernels/cauchy-kernel.js
  var require_cauchy_kernel = __commonJS({
    "node_modules/ml-svm/node_modules/ml-kernel/src/kernels/cauchy-kernel.js"(exports, module) {
      "use strict";
      var squaredEuclidean = require_euclidean2().squared;
      var defaultOptions5 = {
        sigma: 1
      };
      var CauchyKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.sigma = options.sigma;
        }
        compute(x, y) {
          return 1 / (1 + squaredEuclidean(x, y) / (this.sigma * this.sigma));
        }
      };
      module.exports = CauchyKernel;
    }
  });

  // node_modules/ml-svm/node_modules/ml-kernel/src/kernels/exponential-kernel.js
  var require_exponential_kernel = __commonJS({
    "node_modules/ml-svm/node_modules/ml-kernel/src/kernels/exponential-kernel.js"(exports, module) {
      "use strict";
      var euclidean = require_euclidean2();
      var defaultOptions5 = {
        sigma: 1
      };
      var ExponentialKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.sigma = options.sigma;
          this.divisor = 2 * options.sigma * options.sigma;
        }
        compute(x, y) {
          const distance = euclidean(x, y);
          return Math.exp(-distance / this.divisor);
        }
      };
      module.exports = ExponentialKernel;
    }
  });

  // node_modules/ml-svm/node_modules/ml-kernel/src/kernels/histogram-intersection-kernel.js
  var require_histogram_intersection_kernel = __commonJS({
    "node_modules/ml-svm/node_modules/ml-kernel/src/kernels/histogram-intersection-kernel.js"(exports, module) {
      "use strict";
      var HistogramIntersectionKernel = class {
        compute(x, y) {
          var min = Math.min(x.length, y.length);
          var sum2 = 0;
          for (var i = 0; i < min; ++i) {
            sum2 += Math.min(x[i], y[i]);
          }
          return sum2;
        }
      };
      module.exports = HistogramIntersectionKernel;
    }
  });

  // node_modules/ml-svm/node_modules/ml-kernel/src/kernels/laplacian-kernel.js
  var require_laplacian_kernel = __commonJS({
    "node_modules/ml-svm/node_modules/ml-kernel/src/kernels/laplacian-kernel.js"(exports, module) {
      "use strict";
      var euclidean = require_euclidean2();
      var defaultOptions5 = {
        sigma: 1
      };
      var LaplacianKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.sigma = options.sigma;
        }
        compute(x, y) {
          const distance = euclidean(x, y);
          return Math.exp(-distance / this.sigma);
        }
      };
      module.exports = LaplacianKernel;
    }
  });

  // node_modules/ml-svm/node_modules/ml-kernel/src/kernels/multiquadratic-kernel.js
  var require_multiquadratic_kernel = __commonJS({
    "node_modules/ml-svm/node_modules/ml-kernel/src/kernels/multiquadratic-kernel.js"(exports, module) {
      "use strict";
      var squaredEuclidean = require_euclidean2().squared;
      var defaultOptions5 = {
        constant: 1
      };
      var MultiquadraticKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.constant = options.constant;
        }
        compute(x, y) {
          return Math.sqrt(squaredEuclidean(x, y) + this.constant * this.constant);
        }
      };
      module.exports = MultiquadraticKernel;
    }
  });

  // node_modules/ml-svm/node_modules/ml-kernel/src/kernels/rational-quadratic-kernel.js
  var require_rational_quadratic_kernel = __commonJS({
    "node_modules/ml-svm/node_modules/ml-kernel/src/kernels/rational-quadratic-kernel.js"(exports, module) {
      "use strict";
      var squaredEuclidean = require_euclidean2().squared;
      var defaultOptions5 = {
        constant: 1
      };
      var RationalQuadraticKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.constant = options.constant;
        }
        compute(x, y) {
          const distance = squaredEuclidean(x, y);
          return 1 - distance / (distance + this.constant);
        }
      };
      module.exports = RationalQuadraticKernel;
    }
  });

  // node_modules/ml-kernel-sigmoid/sigmoid-kernel.js
  var require_sigmoid_kernel = __commonJS({
    "node_modules/ml-kernel-sigmoid/sigmoid-kernel.js"(exports, module) {
      "use strict";
      var defaultOptions5 = {
        alpha: 0.01,
        constant: -Math.E
      };
      var SigmoidKernel = class {
        constructor(options) {
          options = Object.assign({}, defaultOptions5, options);
          this.alpha = options.alpha;
          this.constant = options.constant;
        }
        compute(x, y) {
          var sum2 = 0;
          for (var i = 0; i < x.length; i++) {
            sum2 += x[i] * y[i];
          }
          return Math.tanh(this.alpha * sum2 + this.constant);
        }
      };
      module.exports = SigmoidKernel;
    }
  });

  // node_modules/ml-svm/node_modules/ml-kernel/src/kernel.js
  var require_kernel = __commonJS({
    "node_modules/ml-svm/node_modules/ml-kernel/src/kernel.js"(exports, module) {
      "use strict";
      var Matrix3 = require_matrix2().Matrix;
      var GaussianKernel = require_gaussian_kernel();
      var PolynomialKernel = require_polynomial_kernel();
      var ANOVAKernel = require_anova_kernel();
      var CauchyKernel = require_cauchy_kernel();
      var ExponentialKernel = require_exponential_kernel();
      var HistogramKernel = require_histogram_intersection_kernel();
      var LaplacianKernel = require_laplacian_kernel();
      var MultiquadraticKernel = require_multiquadratic_kernel();
      var RationalKernel = require_rational_quadratic_kernel();
      var SigmoidKernel = require_sigmoid_kernel();
      var kernelType = {
        gaussian: GaussianKernel,
        rbf: GaussianKernel,
        polynomial: PolynomialKernel,
        poly: PolynomialKernel,
        anova: ANOVAKernel,
        cauchy: CauchyKernel,
        exponential: ExponentialKernel,
        histogram: HistogramKernel,
        min: HistogramKernel,
        laplacian: LaplacianKernel,
        multiquadratic: MultiquadraticKernel,
        rational: RationalKernel,
        sigmoid: SigmoidKernel,
        mlp: SigmoidKernel
      };
      var Kernel = class {
        constructor(type, options) {
          this.kernelType = type;
          if (type === "linear") return;
          if (typeof type === "string") {
            type = type.toLowerCase();
            var KernelConstructor = kernelType[type];
            if (KernelConstructor) {
              this.kernelFunction = new KernelConstructor(options);
            } else {
              throw new Error("unsupported kernel type: " + type);
            }
          } else if (typeof type === "object" && typeof type.compute === "function") {
            this.kernelFunction = type;
          } else {
            throw new TypeError("first argument must be a valid kernel type or instance");
          }
        }
        compute(inputs, landmarks) {
          if (landmarks === void 0) {
            landmarks = inputs;
          }
          if (this.kernelType === "linear") {
            var matrix2 = new Matrix3(inputs);
            return matrix2.mmul(new Matrix3(landmarks).transposeView());
          }
          const kernelMatrix = new Matrix3(inputs.length, landmarks.length);
          var i, j;
          if (inputs === landmarks) {
            for (i = 0; i < inputs.length; i++) {
              for (j = i; j < inputs.length; j++) {
                kernelMatrix[i][j] = kernelMatrix[j][i] = this.kernelFunction.compute(inputs[i], inputs[j]);
              }
            }
          } else {
            for (i = 0; i < inputs.length; i++) {
              for (j = 0; j < landmarks.length; j++) {
                kernelMatrix[i][j] = this.kernelFunction.compute(inputs[i], landmarks[j]);
              }
            }
          }
          return kernelMatrix;
        }
      };
      module.exports = Kernel;
    }
  });

  // node_modules/ml-stat/array.js
  var require_array = __commonJS({
    "node_modules/ml-stat/array.js"(exports) {
      "use strict";
      function compareNumbers(a, b) {
        return a - b;
      }
      exports.sum = function sum2(values) {
        var sum3 = 0;
        for (var i = 0; i < values.length; i++) {
          sum3 += values[i];
        }
        return sum3;
      };
      exports.max = function max(values) {
        var max2 = values[0];
        var l = values.length;
        for (var i = 1; i < l; i++) {
          if (values[i] > max2) max2 = values[i];
        }
        return max2;
      };
      exports.min = function min(values) {
        var min2 = values[0];
        var l = values.length;
        for (var i = 1; i < l; i++) {
          if (values[i] < min2) min2 = values[i];
        }
        return min2;
      };
      exports.minMax = function minMax(values) {
        var min = values[0];
        var max = values[0];
        var l = values.length;
        for (var i = 1; i < l; i++) {
          if (values[i] < min) min = values[i];
          if (values[i] > max) max = values[i];
        }
        return {
          min,
          max
        };
      };
      exports.arithmeticMean = function arithmeticMean(values) {
        var sum2 = 0;
        var l = values.length;
        for (var i = 0; i < l; i++) {
          sum2 += values[i];
        }
        return sum2 / l;
      };
      exports.mean = exports.arithmeticMean;
      exports.geometricMean = function geometricMean(values) {
        var mul = 1;
        var l = values.length;
        for (var i = 0; i < l; i++) {
          mul *= values[i];
        }
        return Math.pow(mul, 1 / l);
      };
      exports.logMean = function logMean(values) {
        var lnsum = 0;
        var l = values.length;
        for (var i = 0; i < l; i++) {
          lnsum += Math.log(values[i]);
        }
        return lnsum / l;
      };
      exports.grandMean = function grandMean(means, samples) {
        var sum2 = 0;
        var n = 0;
        var l = means.length;
        for (var i = 0; i < l; i++) {
          sum2 += samples[i] * means[i];
          n += samples[i];
        }
        return sum2 / n;
      };
      exports.truncatedMean = function truncatedMean(values, percent, alreadySorted) {
        if (alreadySorted === void 0) alreadySorted = false;
        if (!alreadySorted) {
          values = [].concat(values).sort(compareNumbers);
        }
        var l = values.length;
        var k = Math.floor(l * percent);
        var sum2 = 0;
        for (var i = k; i < l - k; i++) {
          sum2 += values[i];
        }
        return sum2 / (l - 2 * k);
      };
      exports.harmonicMean = function harmonicMean(values) {
        var sum2 = 0;
        var l = values.length;
        for (var i = 0; i < l; i++) {
          if (values[i] === 0) {
            throw new RangeError("value at index " + i + "is zero");
          }
          sum2 += 1 / values[i];
        }
        return l / sum2;
      };
      exports.contraHarmonicMean = function contraHarmonicMean(values) {
        var r1 = 0;
        var r2 = 0;
        var l = values.length;
        for (var i = 0; i < l; i++) {
          r1 += values[i] * values[i];
          r2 += values[i];
        }
        if (r2 < 0) {
          throw new RangeError("sum of values is negative");
        }
        return r1 / r2;
      };
      exports.median = function median2(values, alreadySorted) {
        if (alreadySorted === void 0) alreadySorted = false;
        if (!alreadySorted) {
          values = [].concat(values).sort(compareNumbers);
        }
        var l = values.length;
        var half = Math.floor(l / 2);
        if (l % 2 === 0) {
          return (values[half - 1] + values[half]) * 0.5;
        } else {
          return values[half];
        }
      };
      exports.variance = function variance(values, unbiased) {
        if (unbiased === void 0) unbiased = true;
        var theMean = exports.mean(values);
        var theVariance = 0;
        var l = values.length;
        for (var i = 0; i < l; i++) {
          var x = values[i] - theMean;
          theVariance += x * x;
        }
        if (unbiased) {
          return theVariance / (l - 1);
        } else {
          return theVariance / l;
        }
      };
      exports.standardDeviation = function standardDeviation(values, unbiased) {
        return Math.sqrt(exports.variance(values, unbiased));
      };
      exports.standardError = function standardError(values) {
        return exports.standardDeviation(values) / Math.sqrt(values.length);
      };
      exports.robustMeanAndStdev = function robustMeanAndStdev(y) {
        var mean3 = 0, stdev = 0;
        var length = y.length, i = 0;
        for (i = 0; i < length; i++) {
          mean3 += y[i];
        }
        mean3 /= length;
        var averageDeviations = new Array(length);
        for (i = 0; i < length; i++)
          averageDeviations[i] = Math.abs(y[i] - mean3);
        averageDeviations.sort(compareNumbers);
        if (length % 2 === 1) {
          stdev = averageDeviations[(length - 1) / 2] / 0.6745;
        } else {
          stdev = 0.5 * (averageDeviations[length / 2] + averageDeviations[length / 2 - 1]) / 0.6745;
        }
        return {
          mean: mean3,
          stdev
        };
      };
      exports.quartiles = function quartiles(values, alreadySorted) {
        if (typeof alreadySorted === "undefined") alreadySorted = false;
        if (!alreadySorted) {
          values = [].concat(values).sort(compareNumbers);
        }
        var quart = values.length / 4;
        var q1 = values[Math.ceil(quart) - 1];
        var q2 = exports.median(values, true);
        var q3 = values[Math.ceil(quart * 3) - 1];
        return { q1, q2, q3 };
      };
      exports.pooledStandardDeviation = function pooledStandardDeviation(samples, unbiased) {
        return Math.sqrt(exports.pooledVariance(samples, unbiased));
      };
      exports.pooledVariance = function pooledVariance(samples, unbiased) {
        if (typeof unbiased === "undefined") unbiased = true;
        var sum2 = 0;
        var length = 0, l = samples.length;
        for (var i = 0; i < l; i++) {
          var values = samples[i];
          var vari = exports.variance(values);
          sum2 += (values.length - 1) * vari;
          if (unbiased)
            length += values.length - 1;
          else
            length += values.length;
        }
        return sum2 / length;
      };
      exports.mode = function mode2(values) {
        var l = values.length, itemCount = new Array(l), i;
        for (i = 0; i < l; i++) {
          itemCount[i] = 0;
        }
        var itemArray = new Array(l);
        var count = 0;
        for (i = 0; i < l; i++) {
          var index = itemArray.indexOf(values[i]);
          if (index >= 0)
            itemCount[index]++;
          else {
            itemArray[count] = values[i];
            itemCount[count] = 1;
            count++;
          }
        }
        var maxValue = 0, maxIndex = 0;
        for (i = 0; i < count; i++) {
          if (itemCount[i] > maxValue) {
            maxValue = itemCount[i];
            maxIndex = i;
          }
        }
        return itemArray[maxIndex];
      };
      exports.covariance = function covariance2(vector1, vector2, unbiased) {
        if (typeof unbiased === "undefined") unbiased = true;
        var mean1 = exports.mean(vector1);
        var mean22 = exports.mean(vector2);
        if (vector1.length !== vector2.length)
          throw "Vectors do not have the same dimensions";
        var cov = 0, l = vector1.length;
        for (var i = 0; i < l; i++) {
          var x = vector1[i] - mean1;
          var y = vector2[i] - mean22;
          cov += x * y;
        }
        if (unbiased)
          return cov / (l - 1);
        else
          return cov / l;
      };
      exports.skewness = function skewness(values, unbiased) {
        if (typeof unbiased === "undefined") unbiased = true;
        var theMean = exports.mean(values);
        var s2 = 0, s3 = 0, l = values.length;
        for (var i = 0; i < l; i++) {
          var dev = values[i] - theMean;
          s2 += dev * dev;
          s3 += dev * dev * dev;
        }
        var m2 = s2 / l;
        var m3 = s3 / l;
        var g = m3 / Math.pow(m2, 3 / 2);
        if (unbiased) {
          var a = Math.sqrt(l * (l - 1));
          var b = l - 2;
          return a / b * g;
        } else {
          return g;
        }
      };
      exports.kurtosis = function kurtosis(values, unbiased) {
        if (typeof unbiased === "undefined") unbiased = true;
        var theMean = exports.mean(values);
        var n = values.length, s2 = 0, s4 = 0;
        for (var i = 0; i < n; i++) {
          var dev = values[i] - theMean;
          s2 += dev * dev;
          s4 += dev * dev * dev * dev;
        }
        var m2 = s2 / n;
        var m4 = s4 / n;
        if (unbiased) {
          var v = s2 / (n - 1);
          var a = n * (n + 1) / ((n - 1) * (n - 2) * (n - 3));
          var b = s4 / (v * v);
          var c = (n - 1) * (n - 1) / ((n - 2) * (n - 3));
          return a * b - 3 * c;
        } else {
          return m4 / (m2 * m2) - 3;
        }
      };
      exports.entropy = function entropy(values, eps) {
        if (typeof eps === "undefined") eps = 0;
        var sum2 = 0, l = values.length;
        for (var i = 0; i < l; i++)
          sum2 += values[i] * Math.log(values[i] + eps);
        return -sum2;
      };
      exports.weightedMean = function weightedMean(values, weights) {
        var sum2 = 0, l = values.length;
        for (var i = 0; i < l; i++)
          sum2 += values[i] * weights[i];
        return sum2;
      };
      exports.weightedStandardDeviation = function weightedStandardDeviation(values, weights) {
        return Math.sqrt(exports.weightedVariance(values, weights));
      };
      exports.weightedVariance = function weightedVariance(values, weights) {
        var theMean = exports.weightedMean(values, weights);
        var vari = 0, l = values.length;
        var a = 0, b = 0;
        for (var i = 0; i < l; i++) {
          var z = values[i] - theMean;
          var w = weights[i];
          vari += w * (z * z);
          b += w;
          a += w * w;
        }
        return vari * (b / (b * b - a));
      };
      exports.center = function center(values, inPlace) {
        if (typeof inPlace === "undefined") inPlace = false;
        var result = values;
        if (!inPlace)
          result = [].concat(values);
        var theMean = exports.mean(result), l = result.length;
        for (var i = 0; i < l; i++)
          result[i] -= theMean;
      };
      exports.standardize = function standardize(values, standardDev, inPlace) {
        if (typeof standardDev === "undefined") standardDev = exports.standardDeviation(values);
        if (typeof inPlace === "undefined") inPlace = false;
        var l = values.length;
        var result = inPlace ? values : new Array(l);
        for (var i = 0; i < l; i++)
          result[i] = values[i] / standardDev;
        return result;
      };
      exports.cumulativeSum = function cumulativeSum(array) {
        var l = array.length;
        var result = new Array(l);
        result[0] = array[0];
        for (var i = 1; i < l; i++)
          result[i] = result[i - 1] + array[i];
        return result;
      };
    }
  });

  // node_modules/ml-stat/matrix.js
  var require_matrix3 = __commonJS({
    "node_modules/ml-stat/matrix.js"(exports) {
      "use strict";
      var arrayStat = require_array();
      function compareNumbers(a, b) {
        return a - b;
      }
      exports.max = function max(matrix2) {
        var max2 = -Infinity;
        for (var i = 0; i < matrix2.length; i++) {
          for (var j = 0; j < matrix2[i].length; j++) {
            if (matrix2[i][j] > max2) max2 = matrix2[i][j];
          }
        }
        return max2;
      };
      exports.min = function min(matrix2) {
        var min2 = Infinity;
        for (var i = 0; i < matrix2.length; i++) {
          for (var j = 0; j < matrix2[i].length; j++) {
            if (matrix2[i][j] < min2) min2 = matrix2[i][j];
          }
        }
        return min2;
      };
      exports.minMax = function minMax(matrix2) {
        var min = Infinity;
        var max = -Infinity;
        for (var i = 0; i < matrix2.length; i++) {
          for (var j = 0; j < matrix2[i].length; j++) {
            if (matrix2[i][j] < min) min = matrix2[i][j];
            if (matrix2[i][j] > max) max = matrix2[i][j];
          }
        }
        return {
          min,
          max
        };
      };
      exports.entropy = function entropy(matrix2, eps) {
        if (typeof eps === "undefined") {
          eps = 0;
        }
        var sum2 = 0, l1 = matrix2.length, l2 = matrix2[0].length;
        for (var i = 0; i < l1; i++) {
          for (var j = 0; j < l2; j++) {
            sum2 += matrix2[i][j] * Math.log(matrix2[i][j] + eps);
          }
        }
        return -sum2;
      };
      exports.mean = function mean3(matrix2, dimension) {
        if (typeof dimension === "undefined") {
          dimension = 0;
        }
        var rows = matrix2.length, cols = matrix2[0].length, theMean, N, i, j;
        if (dimension === -1) {
          theMean = [0];
          N = rows * cols;
          for (i = 0; i < rows; i++) {
            for (j = 0; j < cols; j++) {
              theMean[0] += matrix2[i][j];
            }
          }
          theMean[0] /= N;
        } else if (dimension === 0) {
          theMean = new Array(cols);
          N = rows;
          for (j = 0; j < cols; j++) {
            theMean[j] = 0;
            for (i = 0; i < rows; i++) {
              theMean[j] += matrix2[i][j];
            }
            theMean[j] /= N;
          }
        } else if (dimension === 1) {
          theMean = new Array(rows);
          N = cols;
          for (j = 0; j < rows; j++) {
            theMean[j] = 0;
            for (i = 0; i < cols; i++) {
              theMean[j] += matrix2[j][i];
            }
            theMean[j] /= N;
          }
        } else {
          throw new Error("Invalid dimension");
        }
        return theMean;
      };
      exports.sum = function sum2(matrix2, dimension) {
        if (typeof dimension === "undefined") {
          dimension = 0;
        }
        var rows = matrix2.length, cols = matrix2[0].length, theSum, i, j;
        if (dimension === -1) {
          theSum = [0];
          for (i = 0; i < rows; i++) {
            for (j = 0; j < cols; j++) {
              theSum[0] += matrix2[i][j];
            }
          }
        } else if (dimension === 0) {
          theSum = new Array(cols);
          for (j = 0; j < cols; j++) {
            theSum[j] = 0;
            for (i = 0; i < rows; i++) {
              theSum[j] += matrix2[i][j];
            }
          }
        } else if (dimension === 1) {
          theSum = new Array(rows);
          for (j = 0; j < rows; j++) {
            theSum[j] = 0;
            for (i = 0; i < cols; i++) {
              theSum[j] += matrix2[j][i];
            }
          }
        } else {
          throw new Error("Invalid dimension");
        }
        return theSum;
      };
      exports.product = function product(matrix2, dimension) {
        if (typeof dimension === "undefined") {
          dimension = 0;
        }
        var rows = matrix2.length, cols = matrix2[0].length, theProduct, i, j;
        if (dimension === -1) {
          theProduct = [1];
          for (i = 0; i < rows; i++) {
            for (j = 0; j < cols; j++) {
              theProduct[0] *= matrix2[i][j];
            }
          }
        } else if (dimension === 0) {
          theProduct = new Array(cols);
          for (j = 0; j < cols; j++) {
            theProduct[j] = 1;
            for (i = 0; i < rows; i++) {
              theProduct[j] *= matrix2[i][j];
            }
          }
        } else if (dimension === 1) {
          theProduct = new Array(rows);
          for (j = 0; j < rows; j++) {
            theProduct[j] = 1;
            for (i = 0; i < cols; i++) {
              theProduct[j] *= matrix2[j][i];
            }
          }
        } else {
          throw new Error("Invalid dimension");
        }
        return theProduct;
      };
      exports.standardDeviation = function standardDeviation(matrix2, means, unbiased) {
        var vari = exports.variance(matrix2, means, unbiased), l = vari.length;
        for (var i = 0; i < l; i++) {
          vari[i] = Math.sqrt(vari[i]);
        }
        return vari;
      };
      exports.variance = function variance(matrix2, means, unbiased) {
        if (typeof unbiased === "undefined") {
          unbiased = true;
        }
        means = means || exports.mean(matrix2);
        var rows = matrix2.length;
        if (rows === 0) return [];
        var cols = matrix2[0].length;
        var vari = new Array(cols);
        for (var j = 0; j < cols; j++) {
          var sum1 = 0, sum2 = 0, x = 0;
          for (var i = 0; i < rows; i++) {
            x = matrix2[i][j] - means[j];
            sum1 += x;
            sum2 += x * x;
          }
          if (unbiased) {
            vari[j] = (sum2 - sum1 * sum1 / rows) / (rows - 1);
          } else {
            vari[j] = (sum2 - sum1 * sum1 / rows) / rows;
          }
        }
        return vari;
      };
      exports.median = function median2(matrix2) {
        var rows = matrix2.length, cols = matrix2[0].length;
        var medians = new Array(cols);
        for (var i = 0; i < cols; i++) {
          var data = new Array(rows);
          for (var j = 0; j < rows; j++) {
            data[j] = matrix2[j][i];
          }
          data.sort(compareNumbers);
          var N = data.length;
          if (N % 2 === 0) {
            medians[i] = (data[N / 2] + data[N / 2 - 1]) * 0.5;
          } else {
            medians[i] = data[Math.floor(N / 2)];
          }
        }
        return medians;
      };
      exports.mode = function mode2(matrix2) {
        var rows = matrix2.length, cols = matrix2[0].length, modes = new Array(cols), i, j;
        for (i = 0; i < cols; i++) {
          var itemCount = new Array(rows);
          for (var k = 0; k < rows; k++) {
            itemCount[k] = 0;
          }
          var itemArray = new Array(rows);
          var count = 0;
          for (j = 0; j < rows; j++) {
            var index = itemArray.indexOf(matrix2[j][i]);
            if (index >= 0) {
              itemCount[index]++;
            } else {
              itemArray[count] = matrix2[j][i];
              itemCount[count] = 1;
              count++;
            }
          }
          var maxValue = 0, maxIndex = 0;
          for (j = 0; j < count; j++) {
            if (itemCount[j] > maxValue) {
              maxValue = itemCount[j];
              maxIndex = j;
            }
          }
          modes[i] = itemArray[maxIndex];
        }
        return modes;
      };
      exports.skewness = function skewness(matrix2, unbiased) {
        if (typeof unbiased === "undefined") unbiased = true;
        var means = exports.mean(matrix2);
        var n = matrix2.length, l = means.length;
        var skew = new Array(l);
        for (var j = 0; j < l; j++) {
          var s2 = 0, s3 = 0;
          for (var i = 0; i < n; i++) {
            var dev = matrix2[i][j] - means[j];
            s2 += dev * dev;
            s3 += dev * dev * dev;
          }
          var m2 = s2 / n;
          var m3 = s3 / n;
          var g = m3 / Math.pow(m2, 3 / 2);
          if (unbiased) {
            var a = Math.sqrt(n * (n - 1));
            var b = n - 2;
            skew[j] = a / b * g;
          } else {
            skew[j] = g;
          }
        }
        return skew;
      };
      exports.kurtosis = function kurtosis(matrix2, unbiased) {
        if (typeof unbiased === "undefined") unbiased = true;
        var means = exports.mean(matrix2);
        var n = matrix2.length, m = matrix2[0].length;
        var kurt = new Array(m);
        for (var j = 0; j < m; j++) {
          var s2 = 0, s4 = 0;
          for (var i = 0; i < n; i++) {
            var dev = matrix2[i][j] - means[j];
            s2 += dev * dev;
            s4 += dev * dev * dev * dev;
          }
          var m2 = s2 / n;
          var m4 = s4 / n;
          if (unbiased) {
            var v = s2 / (n - 1);
            var a = n * (n + 1) / ((n - 1) * (n - 2) * (n - 3));
            var b = s4 / (v * v);
            var c = (n - 1) * (n - 1) / ((n - 2) * (n - 3));
            kurt[j] = a * b - 3 * c;
          } else {
            kurt[j] = m4 / (m2 * m2) - 3;
          }
        }
        return kurt;
      };
      exports.standardError = function standardError(matrix2) {
        var samples = matrix2.length;
        var standardDeviations = exports.standardDeviation(matrix2);
        var l = standardDeviations.length;
        var standardErrors = new Array(l);
        var sqrtN = Math.sqrt(samples);
        for (var i = 0; i < l; i++) {
          standardErrors[i] = standardDeviations[i] / sqrtN;
        }
        return standardErrors;
      };
      exports.covariance = function covariance2(matrix2, dimension) {
        return exports.scatter(matrix2, void 0, dimension);
      };
      exports.scatter = function scatter(matrix2, divisor, dimension) {
        if (typeof dimension === "undefined") {
          dimension = 0;
        }
        if (typeof divisor === "undefined") {
          if (dimension === 0) {
            divisor = matrix2.length - 1;
          } else if (dimension === 1) {
            divisor = matrix2[0].length - 1;
          }
        }
        var means = exports.mean(matrix2, dimension);
        var rows = matrix2.length;
        if (rows === 0) {
          return [[]];
        }
        var cols = matrix2[0].length, cov, i, j, s, k;
        if (dimension === 0) {
          cov = new Array(cols);
          for (i = 0; i < cols; i++) {
            cov[i] = new Array(cols);
          }
          for (i = 0; i < cols; i++) {
            for (j = i; j < cols; j++) {
              s = 0;
              for (k = 0; k < rows; k++) {
                s += (matrix2[k][j] - means[j]) * (matrix2[k][i] - means[i]);
              }
              s /= divisor;
              cov[i][j] = s;
              cov[j][i] = s;
            }
          }
        } else if (dimension === 1) {
          cov = new Array(rows);
          for (i = 0; i < rows; i++) {
            cov[i] = new Array(rows);
          }
          for (i = 0; i < rows; i++) {
            for (j = i; j < rows; j++) {
              s = 0;
              for (k = 0; k < cols; k++) {
                s += (matrix2[j][k] - means[j]) * (matrix2[i][k] - means[i]);
              }
              s /= divisor;
              cov[i][j] = s;
              cov[j][i] = s;
            }
          }
        } else {
          throw new Error("Invalid dimension");
        }
        return cov;
      };
      exports.correlation = function correlation2(matrix2) {
        var means = exports.mean(matrix2), standardDeviations = exports.standardDeviation(matrix2, true, means), scores = exports.zScores(matrix2, means, standardDeviations), rows = matrix2.length, cols = matrix2[0].length, i, j;
        var cor = new Array(cols);
        for (i = 0; i < cols; i++) {
          cor[i] = new Array(cols);
        }
        for (i = 0; i < cols; i++) {
          for (j = i; j < cols; j++) {
            var c = 0;
            for (var k = 0, l = scores.length; k < l; k++) {
              c += scores[k][j] * scores[k][i];
            }
            c /= rows - 1;
            cor[i][j] = c;
            cor[j][i] = c;
          }
        }
        return cor;
      };
      exports.zScores = function zScores(matrix2, means, standardDeviations) {
        means = means || exports.mean(matrix2);
        if (typeof standardDeviations === "undefined") standardDeviations = exports.standardDeviation(matrix2, true, means);
        return exports.standardize(exports.center(matrix2, means, false), standardDeviations, true);
      };
      exports.center = function center(matrix2, means, inPlace) {
        means = means || exports.mean(matrix2);
        var result = matrix2, l = matrix2.length, i, j, jj;
        if (!inPlace) {
          result = new Array(l);
          for (i = 0; i < l; i++) {
            result[i] = new Array(matrix2[i].length);
          }
        }
        for (i = 0; i < l; i++) {
          var row = result[i];
          for (j = 0, jj = row.length; j < jj; j++) {
            row[j] = matrix2[i][j] - means[j];
          }
        }
        return result;
      };
      exports.standardize = function standardize(matrix2, standardDeviations, inPlace) {
        if (typeof standardDeviations === "undefined") standardDeviations = exports.standardDeviation(matrix2);
        var result = matrix2, l = matrix2.length, i, j, jj;
        if (!inPlace) {
          result = new Array(l);
          for (i = 0; i < l; i++) {
            result[i] = new Array(matrix2[i].length);
          }
        }
        for (i = 0; i < l; i++) {
          var resultRow = result[i];
          var sourceRow = matrix2[i];
          for (j = 0, jj = resultRow.length; j < jj; j++) {
            if (standardDeviations[j] !== 0 && !isNaN(standardDeviations[j])) {
              resultRow[j] = sourceRow[j] / standardDeviations[j];
            }
          }
        }
        return result;
      };
      exports.weightedVariance = function weightedVariance(matrix2, weights) {
        var means = exports.mean(matrix2);
        var rows = matrix2.length;
        if (rows === 0) return [];
        var cols = matrix2[0].length;
        var vari = new Array(cols);
        for (var j = 0; j < cols; j++) {
          var sum2 = 0;
          var a = 0, b = 0;
          for (var i = 0; i < rows; i++) {
            var z = matrix2[i][j] - means[j];
            var w = weights[i];
            sum2 += w * (z * z);
            b += w;
            a += w * w;
          }
          vari[j] = sum2 * (b / (b * b - a));
        }
        return vari;
      };
      exports.weightedMean = function weightedMean(matrix2, weights, dimension) {
        if (typeof dimension === "undefined") {
          dimension = 0;
        }
        var rows = matrix2.length;
        if (rows === 0) return [];
        var cols = matrix2[0].length, means, i, ii, j, w, row;
        if (dimension === 0) {
          means = new Array(cols);
          for (i = 0; i < cols; i++) {
            means[i] = 0;
          }
          for (i = 0; i < rows; i++) {
            row = matrix2[i];
            w = weights[i];
            for (j = 0; j < cols; j++) {
              means[j] += row[j] * w;
            }
          }
        } else if (dimension === 1) {
          means = new Array(rows);
          for (i = 0; i < rows; i++) {
            means[i] = 0;
          }
          for (j = 0; j < rows; j++) {
            row = matrix2[j];
            w = weights[j];
            for (i = 0; i < cols; i++) {
              means[j] += row[i] * w;
            }
          }
        } else {
          throw new Error("Invalid dimension");
        }
        var weightSum = arrayStat.sum(weights);
        if (weightSum !== 0) {
          for (i = 0, ii = means.length; i < ii; i++) {
            means[i] /= weightSum;
          }
        }
        return means;
      };
      exports.weightedCovariance = function weightedCovariance(matrix2, weights, means, dimension) {
        dimension = dimension || 0;
        means = means || exports.weightedMean(matrix2, weights, dimension);
        var s1 = 0, s2 = 0;
        for (var i = 0, ii = weights.length; i < ii; i++) {
          s1 += weights[i];
          s2 += weights[i] * weights[i];
        }
        var factor = s1 / (s1 * s1 - s2);
        return exports.weightedScatter(matrix2, weights, means, factor, dimension);
      };
      exports.weightedScatter = function weightedScatter(matrix2, weights, means, factor, dimension) {
        dimension = dimension || 0;
        means = means || exports.weightedMean(matrix2, weights, dimension);
        if (typeof factor === "undefined") {
          factor = 1;
        }
        var rows = matrix2.length;
        if (rows === 0) {
          return [[]];
        }
        var cols = matrix2[0].length, cov, i, j, k, s;
        if (dimension === 0) {
          cov = new Array(cols);
          for (i = 0; i < cols; i++) {
            cov[i] = new Array(cols);
          }
          for (i = 0; i < cols; i++) {
            for (j = i; j < cols; j++) {
              s = 0;
              for (k = 0; k < rows; k++) {
                s += weights[k] * (matrix2[k][j] - means[j]) * (matrix2[k][i] - means[i]);
              }
              cov[i][j] = s * factor;
              cov[j][i] = s * factor;
            }
          }
        } else if (dimension === 1) {
          cov = new Array(rows);
          for (i = 0; i < rows; i++) {
            cov[i] = new Array(rows);
          }
          for (i = 0; i < rows; i++) {
            for (j = i; j < rows; j++) {
              s = 0;
              for (k = 0; k < cols; k++) {
                s += weights[k] * (matrix2[j][k] - means[j]) * (matrix2[i][k] - means[i]);
              }
              cov[i][j] = s * factor;
              cov[j][i] = s * factor;
            }
          }
        } else {
          throw new Error("Invalid dimension");
        }
        return cov;
      };
    }
  });

  // node_modules/ml-stat/index.js
  var require_ml_stat = __commonJS({
    "node_modules/ml-stat/index.js"(exports) {
      "use strict";
      exports.array = require_array();
      exports.matrix = require_matrix3();
    }
  });

  // node_modules/ml-svm/src/svm.js
  var require_svm = __commonJS({
    "node_modules/ml-svm/src/svm.js"(exports, module) {
      "use strict";
      var Kernel = require_kernel();
      var stat = require_ml_stat().array;
      var defaultOptions5 = {
        C: 1,
        tol: 1e-4,
        maxPasses: 10,
        maxIterations: 1e4,
        kernel: "linear",
        alphaTol: 1e-6,
        random: Math.random,
        whitening: true
      };
      function SVM(options) {
        this.options = Object.assign({}, defaultOptions5, options);
        this.kernel = new Kernel(this.options.kernel, this.options.kernelOptions);
        this.b = 0;
      }
      SVM.prototype.train = function(features, labels) {
        if (features.length !== labels.length) {
          throw new Error("Features and labels should have the same length");
        }
        if (features.length < 2) {
          throw new Error("Cannot train with less than 2 observations");
        }
        this._trained = false;
        this._loaded = false;
        this.N = labels.length;
        this.D = features[0].length;
        if (this.options.whitening) {
          this.X = new Array(this.N);
          for (var i = 0; i < this.N; i++) {
            this.X[i] = new Array(this.D);
          }
          this.minMax = new Array(this.D);
          for (var j = 0; j < this.D; j++) {
            var d = new Array(this.N);
            for (i = 0; i < this.N; i++) {
              d[i] = features[i][j];
            }
            this.minMax[j] = stat.minMax(d);
            for (i = 0; i < this.N; i++) {
              this.X[i][j] = (features[i][j] - this.minMax[j].min) / (this.minMax[j].max - this.minMax[j].min);
            }
          }
        } else {
          this.X = features;
        }
        this.Y = labels;
        this.b = 0;
        this.W = void 0;
        var kernel = this.kernel.compute(this.X);
        var m = labels.length;
        var alpha = new Array(m).fill(0);
        this.alphas = alpha;
        for (var a = 0; a < m; a++)
          alpha[a] = 0;
        var b1 = 0, b2 = 0, iter = 0, passes = 0, Ei = 0, Ej = 0, ai = 0, aj = 0, L = 0, H = 0, eta = 0;
        while (passes < this.options.maxPasses && iter < this.options.maxIterations) {
          var numChange = 0;
          for (i = 0; i < m; i++) {
            Ei = this._marginOnePrecomputed(i, kernel) - labels[i];
            if (labels[i] * Ei < -this.options.tol && alpha[i] < this.options.C || labels[i] * Ei > this.options.tol && alpha[i] > 0) {
              j = i;
              while (j === i) j = Math.floor(this.options.random() * m);
              Ej = this._marginOnePrecomputed(j, kernel) - labels[j];
              ai = alpha[i];
              aj = alpha[j];
              if (labels[i] === labels[j]) {
                L = Math.max(0, ai + aj - this.options.C);
                H = Math.min(this.options.C, ai + aj);
              } else {
                L = Math.max(0, aj - ai);
                H = Math.min(this.options.C, this.options.C + aj + ai);
              }
              if (Math.abs(L - H) < 1e-4) continue;
              eta = 2 * kernel[i][j] - kernel[i][i] - kernel[j][j];
              if (eta >= 0) continue;
              var newaj = alpha[j] - labels[j] * (Ei - Ej) / eta;
              if (newaj > H)
                newaj = H;
              else if (newaj < L)
                newaj = L;
              if (Math.abs(aj - newaj) < 1e-3) continue;
              alpha[j] = newaj;
              alpha[i] = alpha[i] + labels[i] * labels[j] * (aj - newaj);
              b1 = this.b - Ei - labels[i] * (alpha[i] - ai) * kernel[i][i] - labels[j] * (alpha[j] - aj) * kernel[i][j];
              b2 = this.b - Ej - labels[i] * (alpha[i] - ai) * kernel[i][j] - labels[j] * (alpha[j] - aj) * kernel[j][j];
              this.b = (b1 + b2) / 2;
              if (alpha[i] < this.options.C && alpha[i] > 0) this.b = b1;
              if (alpha[j] < this.options.C && alpha[j] > 0) this.b = b2;
              numChange += 1;
            }
          }
          iter++;
          if (numChange === 0)
            passes += 1;
          else
            passes = 0;
        }
        if (iter === this.options.maxIterations) {
          throw new Error("max iterations reached");
        }
        this.iterations = iter;
        if (this.options.kernel === "linear") {
          this.W = new Array(this.D);
          for (var r = 0; r < this.D; r++) {
            this.W[r] = 0;
            for (var w = 0; w < m; w++)
              this.W[r] += labels[w] * alpha[w] * this.X[w][r];
          }
        }
        var nX = [];
        var nY = [];
        var nAlphas = [];
        this._supportVectorIdx = [];
        for (i = 0; i < this.N; i++) {
          if (this.alphas[i] > this.options.alphaTol) {
            nX.push(this.X[i]);
            nY.push(labels[i]);
            nAlphas.push(this.alphas[i]);
            this._supportVectorIdx.push(i);
          }
        }
        this.X = nX;
        this.Y = nY;
        this.N = nX.length;
        this.alphas = nAlphas;
        this._trained = true;
      };
      SVM.prototype.predictOne = function(p) {
        var margin = this.marginOne(p);
        return margin > 0 ? 1 : -1;
      };
      SVM.prototype.predict = function(features) {
        if (!this._trained && !this._loaded) throw new Error("Cannot predict, you need to train the SVM first");
        if (Array.isArray(features) && Array.isArray(features[0])) {
          return features.map(this.predictOne.bind(this));
        } else {
          return this.predictOne(features);
        }
      };
      SVM.prototype.marginOne = function(features, noWhitening) {
        if (this.options.whitening && !noWhitening) {
          features = this._applyWhitening(features);
        }
        var ans = this.b, i;
        if (this.options.kernel === "linear" && this.W) {
          for (i = 0; i < this.W.length; i++) {
            ans += this.W[i] * features[i];
          }
        } else {
          for (i = 0; i < this.N; i++) {
            ans += this.alphas[i] * this.Y[i] * this.kernel.compute([features], [this.X[i]])[0][0];
          }
        }
        return ans;
      };
      SVM.prototype._marginOnePrecomputed = function(index, kernel) {
        var ans = this.b, i;
        for (i = 0; i < this.N; i++) {
          ans += this.alphas[i] * this.Y[i] * kernel[index][i];
        }
        return ans;
      };
      SVM.prototype.margin = function(features) {
        if (Array.isArray(features)) {
          return features.map(this.marginOne.bind(this));
        } else {
          return this.marginOne(features);
        }
      };
      SVM.prototype.supportVectors = function() {
        if (!this._trained && !this._loaded) throw new Error("Cannot get support vectors, you need to train the SVM first");
        if (this._loaded && this.options.kernel === "linear") throw new Error("Cannot get support vectors from saved linear model, you need to train the SVM to have them");
        return this._supportVectorIdx;
      };
      SVM.load = function(model) {
        this._loaded = true;
        this._trained = false;
        var svm = new SVM(model.options);
        if (model.options.kernel === "linear") {
          svm.W = model.W.slice();
          svm.D = svm.W.length;
        } else {
          svm.X = model.X.slice();
          svm.Y = model.Y.slice();
          svm.alphas = model.alphas.slice();
          svm.N = svm.X.length;
          svm.D = svm.X[0].length;
        }
        svm.minMax = model.minMax;
        svm.b = model.b;
        svm._loaded = true;
        svm._trained = false;
        return svm;
      };
      SVM.prototype.toJSON = function() {
        if (!this._trained && !this._loaded) throw new Error("Cannot export, you need to train the SVM first");
        var model = {};
        model.options = Object.assign({}, this.options);
        model.b = this.b;
        model.minMax = this.minMax;
        if (model.options.kernel === "linear") {
          model.W = this.W.slice();
        } else {
          model.X = this.X.slice();
          model.Y = this.Y.slice();
          model.alphas = this.alphas.slice();
        }
        return model;
      };
      SVM.prototype._applyWhitening = function(features) {
        if (!this.minMax) throw new Error("Could not apply whitening");
        var whitened = new Array(features.length);
        for (var j = 0; j < features.length; j++) {
          whitened[j] = (features[j] - this.minMax[j].min) / (this.minMax[j].max - this.minMax[j].min);
        }
        return whitened;
      };
      module.exports = SVM;
    }
  });

  // node_modules/ml-naivebayes/src/utils.js
  function separateClasses(X, y) {
    var features = X.columns;
    var classes = 0;
    var totalPerClasses = new Array(1e4);
    for (var i = 0; i < y.length; i++) {
      if (totalPerClasses[y[i]] === void 0) {
        totalPerClasses[y[i]] = 0;
        classes++;
      }
      totalPerClasses[y[i]]++;
    }
    var separatedClasses = new Array(classes);
    var currentIndex = new Array(classes);
    for (i = 0; i < classes; ++i) {
      separatedClasses[i] = new matrix_default(totalPerClasses[i], features);
      currentIndex[i] = 0;
    }
    for (i = 0; i < X.rows; ++i) {
      separatedClasses[y[i]].setRow(currentIndex[y[i]], X.getRow(i));
      currentIndex[y[i]]++;
    }
    return separatedClasses;
  }
  var init_utils3 = __esm({
    "node_modules/ml-naivebayes/src/utils.js"() {
      init_matrix();
    }
  });

  // node_modules/ml-naivebayes/src/GaussianNB.js
  function getCurrentClass(currentCase, mean3, classes) {
    var maxProbability = 0;
    var predictedClass = -1;
    for (var i = 0; i < classes.length; ++i) {
      var currentProbability = classes[i][0];
      for (var j = 1; j < classes[0][1].length + 1; ++j) {
        currentProbability += calculateLogProbability(
          currentCase[j - 1],
          mean3[i][j - 1],
          classes[i][j][0],
          classes[i][j][1]
        );
      }
      currentProbability = Math.exp(currentProbability);
      if (currentProbability > maxProbability) {
        maxProbability = currentProbability;
        predictedClass = i;
      }
    }
    return predictedClass;
  }
  function calculateLogProbability(value, mean3, C1, C2) {
    value = value - mean3;
    return Math.log(C1 * Math.exp(value * value / C2));
  }
  var GaussianNB;
  var init_GaussianNB = __esm({
    "node_modules/ml-naivebayes/src/GaussianNB.js"() {
      init_matrix();
      init_utils3();
      GaussianNB = class _GaussianNB {
        /**
         * Constructor for the Gaussian Naive Bayes classifier, the parameters here is just for loading purposes.
         * @constructor
         * @param {boolean} reload
         * @param {object} model
         */
        constructor(reload, model) {
          if (reload) {
            this.means = model.means;
            this.calculateProbabilities = model.calculateProbabilities;
          }
        }
        /**
         * Function that trains the classifier with a matrix that represents the training set and an array that
         * represents the label of each row in the training set. the labels must be numbers between 0 to n-1 where
         * n represents the number of classes.
         *
         * WARNING: in the case that one class, all the cases in one or more features have the same value, the
         * Naive Bayes classifier will not work well.
         * @param {Matrix|Array} trainingSet
         * @param {Matrix|Array} trainingLabels
         */
        train(trainingSet, trainingLabels) {
          var C1 = Math.sqrt(2 * Math.PI);
          trainingSet = Matrix2.checkMatrix(trainingSet);
          if (trainingSet.rows !== trainingLabels.length) {
            throw new RangeError(
              "the size of the training set and the training labels must be the same."
            );
          }
          var separatedClasses = separateClasses(trainingSet, trainingLabels);
          var calculateProbabilities = new Array(separatedClasses.length);
          this.means = new Array(separatedClasses.length);
          for (var i = 0; i < separatedClasses.length; ++i) {
            var means = separatedClasses[i].mean("column");
            var std = separatedClasses[i].standardDeviation("column", {
              mean: means
            });
            var logPriorProbability = Math.log(
              separatedClasses[i].rows / trainingSet.rows
            );
            calculateProbabilities[i] = new Array(means.length + 1);
            calculateProbabilities[i][0] = logPriorProbability;
            for (var j = 1; j < means.length + 1; ++j) {
              var currentStd = std[j - 1];
              calculateProbabilities[i][j] = [
                1 / (C1 * currentStd),
                -2 * currentStd * currentStd
              ];
            }
            this.means[i] = means;
          }
          this.calculateProbabilities = calculateProbabilities;
        }
        /**
         * function that predicts each row of the dataset (must be a matrix).
         *
         * @param {Matrix|Array} dataset
         * @return {Array}
         */
        predict(dataset) {
          dataset = Matrix2.checkMatrix(dataset);
          if (dataset.rows === this.calculateProbabilities[0].length) {
            throw new RangeError(
              "the dataset must have the same features as the training set"
            );
          }
          var predictions = new Array(dataset.rows);
          for (var i = 0; i < predictions.length; ++i) {
            predictions[i] = getCurrentClass(
              dataset.getRow(i),
              this.means,
              this.calculateProbabilities
            );
          }
          return predictions;
        }
        /**
         * Function that export the NaiveBayes model.
         * @return {object}
         */
        toJSON() {
          return {
            modelName: "NaiveBayes",
            means: this.means,
            calculateProbabilities: this.calculateProbabilities
          };
        }
        /**
         * Function that create a GaussianNB classifier with the given model.
         * @param {object} model
         * @return {GaussianNB}
         */
        static load(model) {
          if (model.modelName !== "NaiveBayes") {
            throw new RangeError(
              "The current model is not a Multinomial Naive Bayes, current model:",
              model.name
            );
          }
          return new _GaussianNB(true, model);
        }
      };
    }
  });

  // node_modules/ml-naivebayes/src/MultinomialNB.js
  var init_MultinomialNB = __esm({
    "node_modules/ml-naivebayes/src/MultinomialNB.js"() {
      init_utils3();
    }
  });

  // node_modules/ml-naivebayes/src/index.js
  var init_src4 = __esm({
    "node_modules/ml-naivebayes/src/index.js"() {
      init_GaussianNB();
      init_MultinomialNB();
    }
  });

  // ml-bundle.js
  var require_ml_bundle = __commonJS({
    "ml-bundle.js"() {
      init_src();
      init_src2();
      init_src3();
      var import_ml_svm = __toESM(require_svm());
      init_src4();
      function ensure2D(X) {
        if (!Array.isArray(X)) throw new Error("X \u5FC5\u9808\u662F array");
        const arr = Array.isArray(X[0]) ? X : [X];
        return arr.map((row) => row.map((v) => isFinite(v) ? Number(v) : 0));
      }
      var DecisionTreeClassifier2 = class {
        constructor(X, y, options) {
          this.model = new DecisionTreeClassifier(options || {});
          this.model.train(ensure2D(X), y);
        }
        predict(X) {
          return this.model.predict(ensure2D(X));
        }
      };
      var DecisionTreeRegression2 = class {
        constructor(X, y, options) {
          this.model = new DecisionTreeRegression(options || {});
          this.model.train(ensure2D(X), y);
        }
        predict(X) {
          return this.model.predict(ensure2D(X));
        }
      };
      var RandomForestClassifier2 = class {
        constructor(X, y, options) {
          this.model = new RandomForestClassifier(options || {});
          this.model.train(ensure2D(X), y);
        }
        predict(X) {
          return this.model.predict(ensure2D(X));
        }
      };
      var RandomForestRegression2 = class {
        constructor(X, y, options) {
          this.model = new RandomForestRegression(options || {});
          this.model.train(ensure2D(X), y);
        }
        predict(X) {
          return this.model.predict(ensure2D(X));
        }
      };
      var NaiveBayes = class {
        constructor(X, y, options) {
          this.model = new GaussianNB(options || {});
          this.model.train(ensure2D(X), y);
        }
        predict(X) {
          return this.model.predict(ensure2D(X));
        }
      };
      var KNN2 = class {
        constructor(X, y, options) {
          this.model = new KNN(ensure2D(X), y, options || {});
        }
        predict(X) {
          return this.model.predict(ensure2D(X));
        }
      };
      var SVM = class {
        constructor(X, y, options) {
          this.model = new import_ml_svm.default(options || {});
          this.model.train(ensure2D(X), y);
        }
        predict(X) {
          return this.model.predict(ensure2D(X));
        }
      };
      window.MLBundle = {
        DecisionTreeClassifier: DecisionTreeClassifier2,
        DecisionTreeRegression: DecisionTreeRegression2,
        RandomForestClassifier: RandomForestClassifier2,
        RandomForestRegression: RandomForestRegression2,
        KNN: KNN2,
        SVM,
        NaiveBayes
      };
    }
  });
  require_ml_bundle();
})();
/*! Bundled license information:

ml-knn/src/KDTree.js:
  (*
   * Original code from:
   *
   * k-d Tree JavaScript - V 1.01
   *
   * https://github.com/ubilabs/kd-tree-javascript
   *
   * @author Mircea Pricop <pricop@ubilabs.net>, 2012
   * @author Martin Kleppe <kleppe@ubilabs.net>, 2012
   * @author Ubilabs http://ubilabs.net, 2012
   * @license MIT License <http://www.opensource.org/licenses/mit-license.php>
   *)
*/
