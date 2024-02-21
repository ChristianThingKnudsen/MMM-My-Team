var NodeHelper = require("node_helper");
// var request = require("request");
let fetch;

import("node-fetch")
	.then((module) => {
		fetch = module.default;
	})
	.catch((err) => console.error("Failed to load node-fetch:", err));

module.exports = NodeHelper.create({
	start: function () {
		console.log("Football fixtures module starting...");
	},

	socketNotificationReceived: function (notification, payload) {
		if (notification == "GET_FOOTBALL_FIXTURES_DATA") {
			var fixtures = [];

			for (var key in payload.leagues) {
				this.fetchData(payload, payload.leagues, key);
			}

			for (var key in payload.preferredLeagues) {
				this.fetchData(payload, payload.preferredLeagues, key);
			}

			for (var key in payload.leaguesShowAllGames) {
				this.fetchData(payload, payload.leaguesShowAllGames, key);
			}
		}
	},

	fetchData: function (payload, leagues, key) {
		Date.prototype.addDays = function (days) {
			var date = new Date(this.valueOf());
			date.setDate(date.getDate() + days);
			return date;
		};

		function pad(num, size) {
			return ("000000000" + num).substr(-size);
		}

		var date = new Date();
		var dateBehind = date.addDays(-1 * payload.daysBehind);
		var dateString = dateBehind.getFullYear() + "-" + pad(dateBehind.getMonth() + 1, 2) + "-" + pad(dateBehind.getDate(), 2);
		var futureDate = date.addDays(payload.daysAhead);
		var futureDateString = futureDate.getFullYear() + "-" + pad(futureDate.getMonth() + 1, 2) + "-" + pad(futureDate.getDate(), 2);

		const url = "http://api.football-data.org/v4/competitions/" + leagues[key] + "/matches/?status=SCHEDULED,LIVE,IN_PLAY,PAUSED,FINISHED&dateFrom=" + dateString + "&dateTo=" + futureDateString;

		const options = {
			method: "GET",
			headers: {
				"X-Auth-Token": payload.apiKey
			}
		};
		const refreshTime = 60000 * leagues.length;
		var self = this;

		fetch(url, options)
			.then((res) => res.text())
			.then(function (body) {
				var data = JSON.parse(body);

				self.sendSocketNotification("FOOTBALL_FIXTURES_DATA", {
					id: leagues[key],
					league: key,
					matches: data.matches,
					competition: data.competition
				});
			})
			.catch(function (e) {
				console.error("MMM-My-Team: Error with from: " + leagues[key]);
				console.error(e);
			});
	}
});
