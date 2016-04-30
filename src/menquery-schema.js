import _ from 'lodash'
import * as menquery from './'
import MenqueryParam from './menquery-param'

/**
 * MenquerySchema class.
 */
export default class MenquerySchema {

  /**
   * Create a schema.
   * @param {Object} [params] - Params object.
   * @param {Object} [options] - Options object.
   */
  constructor (params = {}, options = {}) {
    this.options = options
    this.params = {}
    this.handlers = {
      parsers: {},
      formatters: {},
      validators: {}
    }
    this._params = {
      q: {
        type: RegExp,
        normalize: true,
        paths: ['keywords']
      },
      select: {
        type: [String],
        bindTo: 'select',
        parse: (value) => {
          let fields = _.isArray(value) ? value : [value]
          let query = {}
          fields.forEach((field) => {
            if (_.isNil(field) || _.isEmpty(field)) return
            if (field.charAt(0) === '-') {
              query[field.slice(1)] = 0
            } else if (field.charAt(0) === '+') {
              query[field.slice(1)] = 1
            } else {
              query[field] = 1
            }
          })
          return query
        }
      },
      page: {
        type: Number,
        default: 1,
        max: 30,
        min: 1,
        bindTo: 'cursor',
        parse: (value, path, operator, param, schema) => {
          return {skip: schema.param('limit').value() * (value - 1)}
        }
      },
      limit: {
        type: Number,
        default: 30,
        max: 100,
        min: 1,
        bindTo: 'cursor',
        parse: (value) => ({limit: value})
      },
      sort: {
        type: [String],
        default: 'name',
        bindTo: 'cursor',
        parse: (value) => {
          let fields = _.isArray(value) ? value : [value]
          let sort = {}
          fields.forEach((field) => {
            if (field.charAt(0) === '-') {
              sort[field.slice(1)] = -1
            } else if (field.charAt(0) === '+') {
              sort[field.slice(1)] = 1
            } else {
              sort[field] = 1
            }
          })
          return {sort: sort}
        }
      }
    }

    let keys = _.union(_.keys(this._params), _.keys(params))

    keys.forEach((key) => this.add(key, null, params[key]))

    _.forIn(menquery.handlers, (typedHandler, type) => {
      _.forIn(typedHandler, (handler, name) => {
        this.handler(type, name, handler)
      })
    })
  }

  /**
   * Get or set an option.
   * @param {string} name - Option name.
   * @param {*} [value] - Set the value of the option.
   * @return {*} Value of the option.
   */
  option (name, value) {
    if (arguments.length > 1) {
      this.options[name] = value
    }

    return this.options[name]
  }

  /**
   * Get or set a handler.
   * @param {string} type - Handler type.
   * @param {string} name - Handler name.
   * @param {Function} [fn] - Set the handler method.
   */
  handler (type, name, fn) {
    if (arguments.length > 2) {
      this.handlers[type][name] = fn
      this._refreshHandlersInParams({[type]: {[name]: fn}})
    }

    return this.handlers[type][name]
  }

  /**
   * Get or set a parser.
   * @param {string} name - Parser name.
   * @param {parserFn} [fn] - Set the parser method.
   * @return {parserFn} The parser method.
   */
  parser (name, fn) {
    return this.handler('parsers', ...arguments)
  }

  /**
   * Get or set a formatter.
   * @param {string} name - Formatter name.
   * @param {formatterFn} [fn] - Set the formatter method.
   * @return {formatterFn} The formatter method.
   */
  formatter (name, fn) {
    return this.handler('formatters', ...arguments)
  }

  /**
   * Get or set a validator.
   * @param {string} name - Validator name.
   * @param {validatorFn} [fn] - Set the validator method.
   * @return {validatorFn} The validator method.
   */
  validator (name, fn) {
    return this.handler('validators', ...arguments)
  }

  /**
   * Get a param
   * @param {string} name - Param name.
   * @return {MenqueryParam|undefined} The param or undefined if it doesn't exist.
   */
  get (name) {
    name = this._getSchemaParamName(name)

    return this.params[name]
  }

  /**
   * Set param value.
   * @param {string} name - Param name.
   * @param {*} value - Param value.
   * @param {Object} [options] - Param options.
   * @return {MenqueryParam|undefined} The param or undefined if it doesn't exist.
   */
  set (name, value, options) {
    name = this._getSchemaParamName(name)

    if (this.params[name]) {
      let param = this.params[name]

      param.value(value)

      _.forIn(options, (optionValue, option) => {
        param.option(option, optionValue)
      })

      return param
    } else {
      return
    }
  }

  /**
   * Add param.
   * @param {string} name - Param name.
   * @param {*} [value] - Param value.
   * @param {Object} [options] - Param options.
   * @return {MenqueryParam|boolean} The param or false if param is set to false in schema options.
   */
  add (name, value, options) {
    if (name instanceof MenqueryParam) {
      options = name.options
      value = name.value()
      name = name.name
    }

    name = this._getSchemaParamName(name)

    if (this.options[name] === false) {
      return false
    }

    if (_.isString(options)) {
      options = {default: options}
    } else if (_.isNumber(options)) {
      options = {type: Number, default: options}
    } else if (_.isBoolean(options)) {
      options = {type: Boolean, default: options}
    } else if (_.isDate(options)) {
      options = {type: Date, default: options}
    } else if (_.isRegExp(options)) {
      options = {type: RegExp, default: options}
    } else if (_.isFunction(options)) {
      options = {type: options}
    }

    options = _.assign(this._params[name], options)
    this.params[name] = new MenqueryParam(name, value, options, this)

    this._refreshHandlersInParams(undefined, {[name]: this.params[name]})

    return this.params[name]
  }

  /**
   * Get, set or add param.
   * @param {string} name - Param name.
   * @param {*} [value] - Param value.
   * @param {Object} [options] - Param options.
   * @return {MenqueryParam|undefined} The param or undefined if it doesn't exist.
   */
  param (name, value, options) {
    if (arguments.length === 1) {
      return this.get(name)
    }

    return this.set(name, value, options) || this.add(name, value, options)
  }

  /**
   * Parse values of the schema params.
   * @param {Object} [values] - Object with {param: value} pairs to parse.
   * @return {Object} Parsed object.
   */
  parse (values = {}) {
    let query = {}

    _.forIn(this.params, (param) => {
      let value = values[this._getQueryParamName(param.name)]

      if (!_.isNil(value)) {
        param.value(value)
      }
    })

    _.forIn(this.params, (param) => {
      let bind = param.options.bindTo

      query[bind] = _.assign(query[bind], param.parse())
    })

    return query
  }

  /**
   * Validate values of the schema params.
   * @param {Object} [values] - Object with {param: value} pairs to validate.
   * @param {Function} [next] - Callback to be called with error
   * @return {boolean} Result of the validation.
   */
  validate (values = {}, next = (error) => !error) {
    let error

    if (_.isFunction(values)) {
      next = values
      values = {}
    }

    _.forIn(this.params, (param) => {
      let value = values[this._getQueryParamName(param.name)]

      if (!_.isNil(value)) {
        param.value(value)
      }
    })

    for (let i in this.params) {
      if (error) break
      let param = this.params[i]
      param.validate((err) => { error = err })
    }

    return next(error)
  }

  _refreshHandlersInParams (handlers = this.handlers, params = this.params) {
    _.forIn(handlers, (typedHandler, type) => {
      _.forIn(typedHandler, (handler, name) => {
        _.forIn(params, (param) => {
          param.handler(type, name, handler)
        })
      })
    })
  }

  _getSchemaParamName (paramName) {
    return _.findKey(this.options, (option) => option === paramName) || paramName
  }

  _getQueryParamName (paramName) {
    return this.options[paramName] || paramName
  }

}
