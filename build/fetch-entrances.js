'use strict'

const path = require('path')
const queue = require('queue')
const fs = require('fs')

const queryOverpass = require('./query-overpass')
const findStationByEntrance = require('./find-station-by-entrance')

const showError = (err) => {
	console.error(err)
	process.exit(1)
}

const south = 52.364699
const west = 13.158187
const north = 52.640563
const east = 13.640899
const bbox = [south, west, north, east].join(',')

const query = `\
[out:json][timeout:25];
node["railway"="subway_entrance"](${bbox});
out body;`

const dest = path.join(__dirname, '../entrances.json')

queryOverpass(query)
.then((elements) => {
	const q = queue({concurrency: 2})
	q.on('error', (err) => console.error(err.message))

	const entrances = {} // OSM IDs by VBB station ID
	const resolve = (p) => (cb) => {
		return findStationByEntrance(p)
		.then((id) => {
			if (!entrances[id]) entrances[id] = [p.id]
			else entrances[id].push(p.id)

			console.info(`entrance ${p.id} -> station ${id}`)
			cb()
		})
		.catch(cb)
	}

	for (let p of elements) q.push(resolve(p))
	q.start()

	q.on('end', () => {
		fs.writeFileSync(dest, JSON.stringify(entrances))
	})
})
.catch(showError)
