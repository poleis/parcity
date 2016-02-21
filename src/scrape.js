import EventEmitter from 'events'
import {createSchema} from 'json-gate'
import schema from './schema'
import fetch from 'node-fetch'
import qs from 'querystring'
import debug from 'debug'
import path from 'path'
import hash from 'md5'
import x from 'x-ray'
import {Promise} from 'bluebird'
import fs from 'fs'
import {Writable} from 'stream'
import zipObject from 'lodash/zipObject'
const {validate} = createSchema(schema)
const cacheDir = path.join(__dirname, '../cache')

const log = debug('parcity')

Promise.promisifyAll(fs)

class Scraper extends EventEmitter {
  constructor(conf) {
    super()
    validate(conf)
    this.def = (conf)
  }

  cacheFile(url) {
    return path.join(cacheDir, '/', hash(url) + '.html')
  }

  cachePage(url, contents) {
    const file = this.cacheFile(url)
    return fs.writeFileAsync(file, contents).then(() => contents)
  }

  readListPage(url) {
    const w = x()
    const scrapeList = Promise.promisify(w(
      'ul.search-result-list li',
      [{
        title: 'h3 a',
        url: 'h3 a@href',
        submitter: '.submitter',
        documentId: '.search-result-properties p.id',
        date: '.search-result-properties p.date',
        document_url: '.links a.download@href',
        document_title: '.links a.download'
      }]
    ))
    return scrapeList(url)
  }

  readDetailPages(urls) {
    const details = []
    for (let i = 0; i < urls.length; i++) {
      details.push(this.readDetailPage(urls[i]))
    }
    return Promise.all(details)
  }

  readDetailPage(url) {
    const w = x()
    debug('load detail page: %s', url)
    const scrapeDetail = Promise.promisify(w({
      title: '.paper-description .use-as-title',
      originalTitle: '.paper-description .original-title',
      kamerstuk: '.paper-description a@href',
      headerTitle: '.paper-header h1',
      listTitle: w('.paper-header dl',  ['dt']),
      listDefinitions: w('.paper-header dl', ['dd'])
    }))

    return scrapeDetail(url).then((data) => {
      data.info = zipObject(data.listTitle, data.listDefinitions)
      delete data.listTitle
      delete data.listDefinitions
      return data
    })
  }

  loadDocuments(pages) {
    const documents = []
    for (let i = 0; i < pages.length; i ++) {
      documents.push(this.fetchDocument(pages[i].document_url))
    }
    return Promise.all(documents)
  }

  joinDocuments(documents) {
    if (this.pages.length !== documents.length) {
      throw Error('Inconsistency, bailing out')
    }
    this.pages.forEach((page, nr) => {
      page.document = documents[nr]
    })
    debug('joined documents')
    return this.pages
  }

  fetchDocument(url) {
    debug('fetch document %s', url)
    return fetch(url)
        .then((res) => {
          return res.text()
      })
  }

  joinInfo(details) {
    if (this.pages.length !== details.length) {
      throw Error('Inconsistency, bailing out')
    }
    this.pages.forEach((page, nr) => {
      const detail = details[nr]
      if (detail.kamerstuk === page.document_url) {
        page.details = detail
      } else {
        throw Error('Inconsistency, bailing out')
      }
    })
    return this.pages
  }

  initPages(data) {
    this.pages = data
    return data
  }

  mapUrls(data) {
    return data.map((item) => item.url)
  }

  scrape(){
    const {scrape} = this.def
    const {endpoints} = this.def
    const name = 'kamerstukken'
    const scraper = scrape[name]
    const endpoint = endpoints[name]
    if (endpoint) {
      const queryString = qs.stringify(endpoint.parameters)
      const url = `${endpoint.url}?${queryString}`
      this.readListPage(url)
        .then(this.initPages.bind(this))
        .then(this.mapUrls.bind(this))
        .then(this.readDetailPages.bind(this))
        .then(this.joinInfo.bind(this))
        .then(this.loadDocuments.bind(this))
        .then(this.joinDocuments.bind(this))
        .then((data) => {
           const _data = []
           this.pages.forEach((dus, nr) => {
             _data.push(this.cachePage(nr, JSON.stringify(dus)))
           })
           Promise.all(_data).then((tada) => {
             this.emit('page_data', tada)
           })
        })
    } else {
      throw Error(`Endpoint ${endpoint} is not defined`)
    }
  }
  static create(conf) {
    return new Scraper(conf)
  }
}

module.exports = Scraper

