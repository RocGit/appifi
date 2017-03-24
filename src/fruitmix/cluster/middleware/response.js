/**
 * Created by jianjin.wu on 2017/3/22.
 *
 */

const DEFALUT_SUCCESS_STATUS = 200
const DEFALUT_ERROR_STATUS = 500

//http code
const httpCode = {
  400: 'EINVAL',
  404: 'ENOENT'
}

export default (req, res, next) => {
  /**
   * add res.success()
   * @param data
   * @param status no required
   */
  res.success = (data, status) => {
    data = data || null
    status = status || DEFALUT_SUCCESS_STATUS
    return res.status(status).json(data)
  }

  /**
   * add res.error()
   * @param err {Error} or {String}
   * @param status no required
   */
  res.error = (err, status) => {

    let code, message, stack

    status = status || DEFALUT_ERROR_STATUS
    if (err) {
      if (err instanceof Error) {

        code = err.code
        message = err.message
        stack = err.stack

      } else if (typeof err === 'string') {

        message = err
        code = httpCode[status]

      }
    }

    return res.status(status).json({
      code: code || 'no httpCode',
      message: message || 'system error',
      stack: stack
    })
  }

  next()
}