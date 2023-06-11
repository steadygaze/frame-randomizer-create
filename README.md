# frame-randomizer-create

Pulls data from TMDB into a format digestable by `frame-randomizer`.

```shell
# After downloading/cloning the project, in the repo root:
$ npm install
$ node index.js --help
$ node index.js --api_key <api_key> --tv_id <tv_id> --languages en --output_path /path/to/output.json
```

To get a TMDB API key, follow the instructions in the [TMDB docs](https://developer.themoviedb.org/docs). To get the TV show ID, simply search for the desired show on <https://themoviedb.org> and copy it from the URL.
