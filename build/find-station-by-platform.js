'use strict'

const slug = require('slug')
const shorten = require('vbb-short-station-name')
const stations = require('vbb-stations')('all')

const queryOverpass = require('./query-overpass')
const {parentLookup, elementName, findCloseStation} = require('./helpers')

const tokenize = (name) => {
	return slug(name)
	.toLowerCase()
	.replace(/^u-bahnhof-/, 'u-')
	.replace(/-u-bahnhof-/, '-u-')
	// .replace(/^s-bahnhof-/, 's-')
	// .replace(/-s-bahnhof-/, '-s-')
}

const queryParents = (type, id) => {
	return queryOverpass(parentLookup(type, id))
	.then((elements) => elements.filter((el) => {
		const member = el.members.find((m) => m.ref === id)
		return member && member.role === 'platform'
	}))
}

const match = (osmName, vbbName) => {
	// todo: this is a very cheap algorithm, improve it
	// fails with "S+U Hauptbahnhof" & "U Hauptbahnhof"
	return osmName.indexOf(vbbName) >= 0 || vbbName.indexOf(osmName) >= 0
}

const queryCenter = (id) => {
	return queryOverpass(`[out:json];way(${id});out center;`)
	.then((elements) => elements[0].center)
}

const findStationByPlatform = (p) => {
	if (p.type !== 'way') {
		return Promise.reject(new Error(p.id + ' unknown type ' + p.type))
	}

	// try to match a station by own name
	const name = elementName(p)
	if (name) {
		const osm = tokenize(shorten(name))
		for (let s of stations) {
			const vbb = tokenize(s.name)
			if (match(osm, vbb)) return Promise.resolve(s.id)
		}
	}

	return queryParents('way', p.id)
	.then((parents) => {
		for (let parent of parents) {
			const name = elementName(parent)
			if (!name) continue

			const osm = tokenize(shorten(name))
			for (let s of stations) {
				const vbb = tokenize(s.name)

				if (match(osm, vbb)) return s.id
			}
		}

		// todo: filter stations by platformProduct(p)

		// try to match a single close-by station
		const closeBy = findCloseStation(p.center.lat, p.center.lon)
		if (closeBy) return closeBy.id

		throw new Error(`platform ${p.id} (${name}) does not match`)
	})
}

module.exports = findStationByPlatform
