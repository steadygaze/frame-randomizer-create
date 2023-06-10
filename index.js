#!/usr/bin/env node

const fs = require("node:fs/promises");
const prettier = require("prettier");
const { MovieDb } = require("moviedb-promise");
const yargs = require("yargs");

const options = yargs
  .scriptName("fr-create")
  .usage("Usage: $0 [options]")
  .option("e", {
    alias: "existing_config",
    describe:
      "A previous config to copy information not found on TMDB from, such as timing data.",
    type: "string",
  })
  .option("k", {
    alias: "api_key",
    describe:
      "TMDB API key. See https://www.themoviedb.org/documentation/api for instructions on acquiring one.",
    type: "string",
    demandOption: true,
  })
  .option("l", {
    alias: "languages",
    describe:
      "Comma-separated language list to include. Can be either two-letter code or language-country code.",
    type: "array",
    default: ["en"],
  })
  .option("r", {
    alias: "rate_limit",
    describe: "Maximum number of concurrent API requests.",
    type: "number",
    default: 1,
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
    default: true,
    demandOption: false,
  }).argv;

async function getShowData(options) {
  const [{ default: pLimit }, previousConfig] = await Promise.all([
    import("p-limit"),
    fs.readFile(options.existing_config).then(JSON.parse),
  ]);

  const languages = options.languages.flatMap((multiLanguage) =>
    multiLanguage.split(",")
  );
  const limit = pLimit(options.rate_limit);
  const movieDb = new MovieDb(options.api_key);
  const tvInfo = await Promise.all(
    languages.map((language) =>
      limit(() => movieDb.tvInfo({ id: options.tv_id, language }))
    )
  );
  const original_language = tvInfo[0].original_language;
  const name = {
    name: tvInfo[0].original_name,
    perLanguage: tvInfo.map((info, index) => {
      return { name: info.name, language: languages[index] };
    }),
  };
  const seasons = tvInfo[0].seasons
    .map((season) => season.season_number)
    .filter((season_number) => season_number >= 1) // No specials (season 0).
    .sort();
  const seasonInfosAllSeasons = await Promise.all(
    seasons.map(
      async (season_number) =>
        await Promise.all(
          languages.map((language) =>
            limit(() =>
              movieDb.seasonInfo({ id: options.tv_id, language, season_number })
            )
          )
        )
    )
  );
  const episodes = seasonInfosAllSeasons.flatMap((seasonInfosOneSeason) => {
    const season_number = seasonInfosOneSeason[0].season_number;
    const languageEpisodes = seasonInfosOneSeason.map(({ episodes }, index) => {
      const language = languages[index];
      return episodes.map(({ name, overview }) => {
        return {
          language,
          name,
          ...(overview && { overview }),
        };
      });
    });

    return seasonInfosOneSeason[0].episodes.map(({ episode_number }, index) => {
      return {
        season_number,
        episode_number,
        perLanguage: languageEpisodes.map((perLanguage) => perLanguage[index]),
        timings: previousConfig.episodes.find(
          ({ season_number: prevSeasonN, episode_number: prevEpisodeN }) =>
            prevSeasonN === season_number && prevEpisodeN === episode_number
        ).timings,
      };
    });
  });
  return {
    name,
    ...(original_language &&
      original_language in languages && { defaultLanguage: original_language }),
    episodes,
    commonTimings: previousConfig.commonTimings,
  };
}

getShowData(options).then((result) => {
  const stringified = JSON.stringify(result);
  const output = options.pretty_print
    ? prettier.format(stringified, { parser: "json" })
    : stringified;
  if (options.output_path) {
    return fs.writeFile(options.output_path, output);
  } else {
    console.log(output);
  }
});
