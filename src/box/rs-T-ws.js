const stream = require('stream')
const fs = require('fs')
const crypto = require('crypto')

const Transform = stream.Transform
const SIZE_1G = 1024 * 1024 * 1024
const EMPTY_SHA256_HEX = crypto.createHash('sha256').digest('hex')

class HashTransform extends Transform {
  constructor() {
    super()
    this.hashStream = crypto.createHash('sha256')
    this.length = 0
  }

  _transform(buf, enc, next) {
    this.length += buf.length
    this.hashStream.update(buf, enc)
    this.push(buf)
    next()
  }

/**  
  getHash() {
    return this.hashStream.digest('hex')
  }
**/
  
  _flush(next) {
    this.digest = this.hashStream.digest('hex')
    next()
  }
}


// method_1
class Transfer {
  constructor() {
    this.hashArr = []
  }

  storeFile(src, dst, callback) {
    let rs = fs.createReadStream(src)
    let ws = fs.createWriteStream(dst, { flags: 'a'})
    let hashMaker = new HashTransform()
    hashMaker.pipe(ws)
    let finished = false

    let error = (err) => {
      if (finished) return
      finished = true
      return callback(err)
    }

    let finish = (hashArr) => {
      if (finished) return
      finished = true
      return callback(null, hashArr)
    }

    let abort = () => {
      if (finished) return
      finished = true
      return callback(new Error('ABORT'))
    }

    console.log(hashMaker.length)
    rs.on('data', data => {
      let chunk = Buffer.from(data)

      if (hashMaker.length + chunk.length >= SIZE_1G) {
        rs.pause()
        // 1. write data to full
        // 2. update hash and push into hashArr
        // 3. write the rest of data
        let len = SIZE_1G - hashMaker.length
        console.log('len',len)
        console.log(1111, hashMaker.length)
        // write data to full
        hashMaker.write(chunk.slice(0, len))
        console.log('lenght1',hashMaker.length)
        // update hash in hashArr
        let digest = hashMaker.getHash()
        this.hashArr.push(digest)
        console.log(this.hashArr)
        // write the rest of data
        hashMaker = new HashTransform()

        console.log('new hashMaker is ready')
        console.log('length2',hashMaker.length)
        hashMaker.pipe(ws)
        hashMaker.write(chunk.slice(len))
        console.log('length3',hashMaker.length)
        
        console.log('aaaa')
        rs.resume()

        // push hash into hashArr
        // this.hashArr.push(hashMaker.getHash())
      } else {
        hashMaker.write(data)
      }
    })

    rs.on('close', () => {
      ws.close()
      console.log('closed')
      let digest = hashMaker.getHash()
      this.hashArr.push(digest)
      console.log(this.hashArr)
      if (this.hashArr.length === 1) finish(digest)
      else {
        hashMaker = new HashTransform()
        hashMaker.write(this.hashArr[0])
        for(let i = 1; i < this.hashArr.length; i++) {
          hashMaker.write(this.hashArr[i])
          digest = hashMaker.getHash()
          if (i === this.hashArr.length - 1) finish(digest)
          else {
            hashMaker = new HashTransform()
            hashMaker.write(digest)
          }
        }
      }     
    })

    rs.on('error', err => error(err))
  }
}

// method_2: rs -> ws     (when 1G is written, calculate hash)
class Transfer_1 {
  constructor() {
    this.hashArr = []
  }

  storeFile(src, dst, callback) {
    let rs = fs.createReadStream(src)
    let ws = fs.createWriteStream(dst)
    let size = 0, finished = false
    rs.pipe(ws)
    let hashMaker = crypto.createHash('sha256')

    let error = (err) => {
      if (finished) return
      finished = true
      return callback(err)
    }

    let finish = (hashArr) => {
      if (finished) return
      finished = true
      return callback(null, hashArr)
    }

    let abort = () => {
      if (finished) return
      finished = true
      return callback(new Error('ABORT'))
    }

    rs.on('data', data => {
      let chunk = Buffer.from(data)

      if (size + chunk.length >= SIZE_1G) {
        rs.pause()

        // write data to full, update hash
        let len = SIZE_1G - size
        hashMaker.update(chunk.slice(0, len))
        this.hashArr.push(hashMaker.digest('hex'))

        // write the rest of data
        size = chunk.slice(len).length
        hashMaker = crypto.createHash('sha256')
        hashMaker.update(chunk.slice(len))
      } else {
        size += chunk.length
        hashMaker.update(chunk)
      }
    })

    rs.on('close', () => {
      console.log('closed')
      let digest = hashMaker.digest('hex')
      this.hashArr.push(digest)
      console.log(this.hashArr)
      if (this.hashArr.length === 1) finish(digest)
      else {
        hashMaker = crypto.createHash('sha256')
        hashMaker.update(Buffer.from(this.hashArr[0]))
        for(let i = 1; i < this.hashArr.length; i++) {
          hashMaker.update(Buffer.from(this.hashArr[i]))
          digest = hashMaker.digest('hex')
          if (i === this.hashArr.length - 1) finish(digest)
          else {
            hashMaker = crypto.createHash('sha256')
            hashMaker.update(Buffer.from(digest))
          }
        }
      }     
    })

    rs.on('error', err => error(err))
  }
}

// method_3: rs -> ws     (write to destination)
//              -> T      (calculate hash)
class Transfer_2 {
  constructor() {
    this.hashArr = []
  }

  storeFile(src, dst) {

  }
}


let fpath = '/home/laraine/Projects/appifi/test-files/two-and-a-half-giga'
let dst = '/home/laraine/Projects/appifi/tmptest/two-and-a-half-giga'

// let fpath = '/home/laraine/Projects/appifi/testdata/hello'
// let dst = '/home/laraine/Projects/appifi/tmptest/hello'

let worker = new Transfer_1()
worker.storeFile(fpath, dst, (err, hashArr) => console.log('hashArr', hashArr))

