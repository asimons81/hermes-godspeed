export const Action = {
  Jump: 'jump',
  Slide: 'slide',
  LaneLeft: 'laneLeft',
  LaneRight: 'laneRight',
  Pause: 'pause'
} as const;

export type ActionName = (typeof Action)[keyof typeof Action];

export type ActionEventDetail = {
  action: ActionName;
  pressed: boolean;
};
