const Promise = require('bluebird')
const path = require('path')
const fs = Promise.promisifyAll(require('fs'))
const EventEmitter = require('events')
const crypto = require('crypto')

const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const mkdirpAsync = Promise.promisify(mkdirp)
const rimrafAsync = Promise.promisify(rimraf)

const UUID = require('uuid')

const User = require('./User')
const Drive = require('./Drive')
const MediaMap = require('../media/persistent')
const Thumbnail = require('./Thumbnail')
const VFS = require('./VFS')
const NFS = require('./NFS')
const Tag = require('../tags/Tag')
const DirApi = require('./apis/dir')
const DirEntryApi = require('./apis/dir-entry')
const Task = require('./Task')


/**
Fruitmix is the top-level container for all modules inside fruitmix fs service.

Fruitmix has the following structure:

```
{
  user,
  drive,
  tag,

  xstat,
  mediaMap,
  forest,
  vfs, 

  xcopy,
  search, 

  transmission,
  samba,
  dlna,

  apis: {
    user,
    drive,
    tag,
    dir,
    dirEntry,
    file,
    media,
    task,
    taskNode,
    nfs
  }
}
```

1. we define a set of standard api methods.
2. developer can write a separate api module, or just implements those apis on the resource model module.

For example: user module provides apis. so fruitmix.user and fruitmix.apis.user are the same instance.

but for directories and files api, it is obviously that the separate api module should be created. Both depends on VFS module.


Fruitmix has no knowledge of chassis, storage, etc.
*/
class Fruitmix2 extends EventEmitter {
  /**
  @param {object} opts
  @param {string} opts.fruitmixDir - absolute path
  @param {boolean} opts.useSmb - use samba module
  @param {boolean} opts.useDlna - use dlna module
  @param {boolean} opts.useTransmission - use transmission module
  @param {object} opts.boundUser - if provided, the admin is forcefully updated
  */
  constructor (opts) {
    super()
    this.fruitmixDir = opts.fruitmixDir
    mkdirp.sync(this.fruitmixDir)

    this.tmpDir = path.join(this.fruitmixDir, 'tmp')
    rimraf.sync(this.tmpDir)
    mkdirp.sync(this.tmpDir)

    // setup user module
    this.user = new User({
      file: path.join(this.fruitmixDir, 'users.json'),
      tmpDir: path.join(this.fruitmixDir, 'tmp', 'users'),
      isArray: true
    })

    // set a getter method for this.users
    Object.defineProperty(this, 'users', {
      get () {
        return this.user.users || [] // TODO can this be undefined?
      }
    })

    this.drive = new Drive({
      file: path.join(this.fruitmixDir, 'drives.json'),
      tmpDir: path.join(this.fruitmixDir, 'tmp', 'drives')
    }, this.user)

    Object.defineProperty(this, 'drives', {
      get () {
        return this.drive.drives || [] // TODO can this be undefined?
      }
    })

    this.tag = new Tag({
      file: path.join(this.fruitmixDir, 'tags.json'),
      tmpDir: path.join(this.fruitmixDir, 'tmp', 'tags'),
      isArray: false
    })

    let metaPath = path.join(this.fruitmixDir, 'metadataDB.json')
    this.mediaMap = new MediaMap(metaPath, this.tmpDir) // TODO suffix tmpdir ?

    let vfsOpts = {
      fruitmixDir: this.fruitmixDir,
      mediaMap: this.mediaMap
    }
    this.vfs = new VFS(vfsOpts, this.user, this.drive, this.tag)

    this.dirApi = new DirApi(this.vfs)
    this.dirEntryApi = new DirEntryApi(this.vfs)

    this.task = new Task(this.vfs)

    this.thumbnail = new Thumbnail(path.join(this.fruitmixDir, 'thumbnail'), this.tmpDir)

    this.user.on('Update', () => {
      this.emit('FruitmixStarted')
    })

    this.apis = {
      user: this.user,
      drive: this.drive,
      tag: this.tag,
      dir: this.dirApi,
      dirEntry: this.dirEntryApi,
      task: this.task,
      taskNode: this.task.nodeApi
    }
  }

  init (opts) {
    this.emit('initialized')
  }

  /**
  */
  getUsers () {
    return this.users.map(u => ({
      uuid: u.uuid,
      username: u.username,
      isFirstUser: u.isFirstUser,
      phicommUserId: u.phicommUserId,
      password: !!u.password,
      smbPassword: !!u.smbPassword
    }))
  }

  /**
  This function returns a list of users with minimal attributes.
  */
  displayUsers () {
    return this.users.map(u => ({
      uuid: u.uuid,
      username: u.username,
      isFirstUser: u.isFirstUser,
      phicommUserId: u.phicommUserId
    }))
  }
}

module.exports = Fruitmix2
