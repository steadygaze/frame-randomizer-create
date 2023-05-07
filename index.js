#!/usr/bin/env node

const fs = require("node:fs/promises");
const prettier = require("prettier");
const { MovieDb } = require("moviedb-promise");
const yargs = require("yargs");

const options = yargs
  .scriptName("fr-create")
  .usage("Usage: $0 [options]")
  .option("k", {
    alias: "api_key",
    describe:
      "TMDB API key. See https://www.themoviedb.org/documentation/api for instructions on acquiring one.",
    type: "string",
    demandOption: true,
  })
  .option("t", {
    alias: "tv_id",
    describe:
      "TV show ID in TMDB. This is available from the URL when viewing a TV show on http://www.themoviedb.org.",
    type: "string",
    demandOption: true,
  })
  .option("o", {
    alias: "output_path",
    describe: "Output file. If omitted, print to stdout instead.",
    type: "string",
    demandOption: false,
  })
  .option("p", {
    alias: "pretty_print",
    describe: "Pretty print JSON output. Otherwise, output will be minified.",
    type: "boolean",
    demandOption: false,
  }).argv;

async function getEpisodeInfo(options) {
  const movieDb = new MovieDb(options.api_key);
  const tvInfo = await movieDb.tvInfo(options.tv_id);
  const seasons = tvInfo.seasons
    .map((season) => season.season_number)
    .filter((seasonN) => seasonN >= 1)
    .sort();
  const seasonInfo = await Promise.all(
    seasons.map((seasonN) =>
      movieDb.seasonInfo({ id: options.tv_id, season_number: seasonN })
    )
  );
  const episodeData = seasonInfo.flatMap((season) =>
    season.episodes.map(({ name, overview, season_number, episode_number }) => {
      return {
        name,
        overview,
        season: season_number,
        episode: episode_number,
      };
    })
  );
  return episodeData;
}

getEpisodeInfo(options).then((result) => {
  const stringified = JSON.stringify({ entries: result });
  const output = options.pretty_print
    ? prettier.format(stringified, { parser: "json" })
    : stringified;
  if (options.output_path) {
    return fs.writeFile(options.output_path, output);
  } else {
    console.log(output);
  }
});
