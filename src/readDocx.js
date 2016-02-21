import unzip from 'unzip'
import path from 'path'
import fs from 'fs'

const file = path.join(__dirname, '../test/fixtures/docx/Middensegment_huur.docx')

/*
readDocx(file, (xml) => {
  console.log(xml)
})
*/

function readEntry(cb) {
  return function(entry) {
    let fileName = entry.path
    let xml = ''
    if (fileName === 'word/document.xml') {
      entry.on('data', (buffer) => xml += buffer.toString())
      entry.on('end', () => cb(xml))
    } else {
      entry.autodrain()
    }
  }
}

export default function readDocx(file, cb) {
  fs.createReadStream(file)
    .pipe(unzip.Parse())
    .on('entry', readEntry(cb))
}
