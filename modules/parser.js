import Metadata from 'matroska-metadata'
import Debug from 'debug'
import { arr2hex, hex2bin } from 'uint8-util'
import { fontRx } from './util.js'
import { EventEmitter } from 'events'
import { SUPPORTS } from './support.js'

const debug = Debug('torrent:parser')

export default class Parser extends EventEmitter  {
  parsed = false
  /** @type {Metadata} */
  metadata = null
  file = null
  destroyed = false

  constructor (file) {
    super();
    debug('Initializing parser for file: ' + file.name)
    // this.client = client
    this.file = file

    debug(`Inspecting file object: typeof file.on = ${typeof file.on}`);
    debug(`Inspecting file object: file.constructor.name = ${file.constructor?.name}`);
    
    this.metadata = new Metadata(file)

    this.metadata.getTracks().then(tracks => {
      if (this.destroyed) return
      debug('Tracks received: ' + tracks)
      if (!tracks.length) {
        this.parsed = true
        this.destroy()
      } else {
        this.emit('tracks', tracks)
      }
    })

    this.metadata.getChapters().then(chapters => {
      if (this.destroyed) return
      debug(`Found ${chapters.length} chapters`)
      this.emit('chapters', chapters)
    })

    this.metadata.getAttachments().then(files => {
      if (this.destroyed) return
      debug(`Found ${files.length} attachments`)
      for (const file of files) {
        if (fontRx.test(file.filename) || file.mimetype?.toLowerCase().includes('font')) {
          const data = hex2bin(arr2hex(file.data))
          if (SUPPORTS.isAndroid && data.length > 15_000_000) {
            debug('Skipping large font file on Android: ' + file.filename)
            continue
          }
          this.emit('file', data)
        }
      }
    })

    this.metadata.on('subtitle', (subtitle, trackNumber) => {
      if (this.destroyed) return
      debug(`Found subtitle for track: ${trackNumber}: ${subtitle.text}`)
      this.emit('subtitle', { subtitle, trackNumber })
    })

    if (this.file.name.endsWith('.mkv') || this.file.name.endsWith('.webm')) {
      this.file.on('iterator', ({ iterator }, cb) => {
        debug(`Parser hooked into iterator for index ${file.name}}`)
        if (this.destroyed) return cb(iterator)
        cb(this.metadata.parseStream(iterator))
      })
    } else {
      debug('Unsupported file format: ' + this.file.name)
    }
  }

  destroy () {
    debug('Destroying Parser')
    this.destroyed = true
    // Add any additional cleanup code here
  }
}