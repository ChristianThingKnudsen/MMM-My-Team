Module.register("MMM-My-Team", {
  defaults: {
    apiKey: null,
    coloured: false,
    leagues: {},
    preferredLeagues: {},
    leaguesShowAllGames: {},
    teams: [],
    teamBadges: {},
    daysAhead: 30,
    daysBehind: 2,
    displayMax: 3,
  },

  leagueTable: [],
  teamBadges: {},

  start: function () {
    Log.info("Starting module: " + this.name);
    this.getData();

    // refresh every x milliseconds
    setInterval(
      this.getData.bind(this),
      this.config.apiKey ? 900000 : 1800000 // with apiKey every 15min, without every 30min
    );

    this.updateDom = this.updateDom.bind(this);
    this.socketNotificationReceived =
      this.socketNotificationReceived.bind(this);

    var updateDom = this.updateDom;

    // refresh every x milliseconds
    setInterval(this.updateDom, 5000);
  },

  getData: function () {
    this.sendSocketNotification("GET_FOOTBALL_FIXTURES_DATA", {
      apiKey: this.config.apiKey,
      leagues: this.config.leagues,
      preferredLeagues: this.config.preferredLeagues,
      leaguesShowAllGames: this.config.leaguesShowAllGames,
      daysAhead: this.config.daysAhead,
      daysBehind: this.config.daysBehind,
      displayMax: this.config.displayMax,
    });
  },

  updateLeagueTable: function (data, teams) {
    var config = this.config;

    var prioritisedMatches = data.matches.filter(function (match) {
      for (key in config.leaguesShowAllGames) {
        if (config.leaguesShowAllGames[key] == data.competition.code) {
          return true;
        }
      }

      for (key in config.preferredLeagues) {
        if (config.preferredLeagues[key] == data.competition.code) {
          return (
            teams.includes(match.homeTeam.name) ||
            teams.includes(match.awayTeam.name)
          );
        }
      }

      for (key in config.leagues) {
        if (config.leagues[key] == data.competition.code) {
          return (
            teams.includes(match.homeTeam.name) &&
            teams.includes(match.awayTeam.name)
          );
        }
      }

      return false;
    });

    function getFormattedDate(date) {
      var monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      var dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      return (
        dayNames[date.getDay()] +
        " " +
        getOrdinalNum(date.getDate()) +
        " " +
        monthNames[date.getMonth()]
      );
    }

    function getOrdinalNum(n) {
      return (
        n +
        (n > 0
          ? ["th", "st", "nd", "rd"][
              (n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10
            ]
          : "")
      );
    }

    function findObjectWithDate(array, date) {
      for (var i = 0; i < array.length; i++) {
        if (array[i].formattedDate == date) {
          return i;
        }
      }

      return -1;
    }

    function sortByUtcDate(a, b) {
      var dateA = a.utcDate;
      var dateB = b.utcDate;

      if (dateA < dateB) {
        return -1;
      }

      if (dateA > dateB) {
        return 1;
      }

      return 0;
    }

    function sortByKickOff(a, b) {
      var dateA = Date.parse(a.utcDate);
      var dateB = Date.parse(b.utcDate);

      if (dateA < dateB) {
        return -1;
      }

      if (dateA > dateB) {
        return 1;
      }

      return 0;
    }

    function addToFormattedMatchesArray(array, match) {
      var formattedDate = getFormattedDate(new Date(match.utcDate));
      var index = findObjectWithDate(array, formattedDate);

      if (index == -1) {
        // date does not exist in array
        array.push({
          formattedDate: formattedDate,
          utcDate: new Date(match.utcDate),
          games: [match],
        });
      } else {
        // a match on this day is already present

        // check if match is already in array, if so replace it
        var found = false;
        for (var i = 0; i < array[index].games.length; i++) {
          var currentMatch = array[index].games[i];

          if (currentMatch.id == match.id) {
            array[index].games[i] = match;
            found = true;
          }
        }

        if (!found) {
          array[index].games.push(match);
        }

        array[index].games = array[index].games.sort(sortByKickOff);
      }
    }

    var formattedMatches = [];

    var leagueTable = this.leagueTable;

    prioritisedMatches.map(function (match) {
      addToFormattedMatchesArray(leagueTable, match);
    });

    this.leagueTable = this.leagueTable.sort(sortByUtcDate);
  },

  getScripts: function () {
    return ["//cdnjs.cloudflare.com/ajax/libs/jquery/2.2.2/jquery.js"];
  },

  getStyles: function () {
    return ["MMM-My-Team.css"];
  },

  getHeader: function () {
    return "Football Fixtures";
  },

  getDom: function () {
    function pad(num, size) {
      return ("000000000" + num).substr(-size);
    }

    var table = document.createElement("table");
    table.classList.add("football-fixtures-table", "xsmall");

    var maxGames = this.config.displayMax;
    var numberOfGames = this.leagueTable
      .map(function (day) {
        return day.games.length;
      })
      .reduce((a, b) => a + b, 0);
    var gamesToDisplay = Math.min(maxGames, numberOfGames);

    var leagueGames = document.createElement("tbody");
    leagueGames.classList.add("league-games");

    for (var i = 0; i < this.leagueTable.length; i++) {
      if (gamesToDisplay < 0) {
        break;
      }

      var day = this.leagueTable[i];

      var dateRow = document.createElement("tr");
      dateRow.classList.add("date-row");

      var dateCell = document.createElement("td");
      dateCell.classList.add("centered");
      dateCell.colSpan = 5;
      dateCell.innerHTML = day.formattedDate;

      dateRow.appendChild(dateCell);
      leagueGames.appendChild(dateRow);

      for (var j = 0; j < day.games.length; j++) {
        gamesToDisplay--;

        if (gamesToDisplay < 0) {
          break;
        }

        var game = day.games[j];

        var gameRow = document.createElement("tr");

        var homeIconCell = document.createElement("td");
        var homeIcon = document.createElement("img");
        homeIcon.classList.add("team-icon");

        if (game.homeTeam.crest) {
          homeIcon.src = game.homeTeam.crest;
        } else {
          homeIcon.src =
            "https://www.hamptoncourthouse.co.uk/wp-content/uploads/2016/12/Football-256x256.png";
        }

        homeIconCell.appendChild(homeIcon);
        var homeTeamName = document.createElement("td");
        homeTeamName.classList.add("team-cell", "-home");
        homeTeamName.innerHTML = game.homeTeam.name;

        if (this.config.teams.includes(game.homeTeam.name)) {
          homeTeamName.style.fontWeight = "bold";
        }

        var gameTimeCell = document.createElement("td");
        gameTimeCell.style.textAlign = "center";

        switch (game.status) {
          case "FINISHED":
            if (game.score.extraTime?.homeTeam) {
              gameTimeCell.innerHTML =
                game.score.extraTime.home +
                " : " +
                game.score.extraTime.away +
                " ";
              var minNode = document.createElement("strong");
              minNode.innerText = "(ET)";
              gameTimeCell.appendChild(minNode);
            } else {
              gameTimeCell.innerHTML =
                game.score.fullTime.homeTeam +
                " : " +
                game.score.fullTime.awayTeam;
            }
            break;
          case "IN_PLAY":
            if (game.score.extraTime?.homeTeam) {
              gameTimeCell.innerHTML =
                game.score.extraTime.homeTeam +
                " : " +
                game.score.extraTime.awayTeam +
                " ";
            } else if (game.score.fullTime.homeTeam) {
              gameTimeCell.innerHTML =
                game.score.fullTime.homeTeam +
                " : " +
                game.score.fullTime.awayTeam +
                " ";
            }

            var minNode = document.createElement("strong");
            minNode.innerText = "(LIVE)";
            gameTimeCell.appendChild(minNode);
            break;
          case "PAUSED":
            gameTimeCell.innerHTML =
              game.score.halfTime.homeTeam +
              " : " +
              game.score.halfTime.awayTeam +
              " ";
            var htNode = document.createElement("strong");
            htNode.innerText = "(HT)";
            gameTimeCell.appendChild(htNode);
            break;
          default:
            var date = new Date(game.utcDate);
            gameTimeCell.innerHTML =
              pad(date.getHours(), 2) + ":" + pad(date.getMinutes(), 2);
            break;
        }

        var awayIconCell = document.createElement("td");
        var awayIcon = document.createElement("img");
        awayIcon.classList.add("team-icon");

        if (game.awayTeam.crest) {
          awayIcon.src = game.awayTeam.crest;
        } else {
          awayIcon.src =
            "https://www.hamptoncourthouse.co.uk/wp-content/uploads/2016/12/Football-256x256.png";
        }

        awayIconCell.appendChild(awayIcon);
        var awayTeamName = document.createElement("td");
        awayTeamName.classList.add("team-cell", "-away");
        awayTeamName.innerHTML = game.awayTeam.name;

        if (this.config.teams.includes(game.awayTeam.name)) {
          awayTeamName.style.fontWeight = "bold";
        }

        gameRow.appendChild(homeIconCell);
        gameRow.appendChild(homeTeamName);
        gameRow.appendChild(gameTimeCell);
        gameRow.appendChild(awayTeamName);
        gameRow.appendChild(awayIconCell);

        leagueGames.appendChild(gameRow);
      }

      if (gamesToDisplay < 0) {
        break;
      }
    }

    table.appendChild(leagueGames);

    return table;
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "FOOTBALL_FIXTURES_DATA":
        this.updateLeagueTable(payload, this.config.teams);
        break;
    }
  },
});
