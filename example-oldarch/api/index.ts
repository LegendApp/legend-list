import {PixelRatio} from 'react-native';

export interface Playlist {
  id: string;
  title: string;
}

export interface Movie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

export const IMAGE_SIZE = {
  width: 92,
  height: 138,
};

const POSTER_SIZES = [92, 154, 185, 342, 500, 780];
const POSTER_SIZE = POSTER_SIZES.find(
  size => size >= PixelRatio.getPixelSizeForLayoutSize(IMAGE_SIZE.width),
);

export const getImageUrl = (path: string) =>
  `https://image.tmdb.org/t/p/w${POSTER_SIZE}${path}`;
