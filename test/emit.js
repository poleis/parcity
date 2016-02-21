'use strict'

import Scrape from '../src/scrape'
import yaml from 'js-yaml'
import fs from 'fs'
import path from 'path'

const debug = false

describe('Scrape test', () => {
  it('Should emit records', (done) => {
    const conf = yaml.safeLoad(
      fs.readFileSync(path.join(__dirname, '../defs/kamervragen.yml'), 'utf8')
    )
    const scraper = Scrape.create(conf)
    scraper.scrape()
    scraper.on('page_data', (record) => {
      console.log(JSON.stringify(record, null))
      done()
    })
  })
})
