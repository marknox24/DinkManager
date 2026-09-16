import { BracketScreen, CategoriesScreen, DashboardScreen, MatchListScreen, RegistrationsScreen } from '../mockups/OrganizerScreens';

// Each card is a real product screen, not an abstract shape. `dock` is where
// it settles once organized; `scatter` is where it starts — flung out and
// tilted away from camera, smaller and dimmer, like it hasn't found its
// place yet. GSAP tweens every field between the two as the hero scrolls.
export const HERO_CARDS = [
  {
    id: 'brackets',
    Screen: BracketScreen,
    width: 300,
    height: 200,
    dock: { x: -232, y: -22, z: -150, rotateX: 4, rotateY: 20, rotateZ: -4, scale: 0.68, opacity: 1 },
    scatter: { x: -520, y: 210, z: -460, rotateX: -14, rotateY: 46, rotateZ: -14, scale: 0.58, opacity: 0.2 },
  },
  {
    id: 'matches',
    Screen: MatchListScreen,
    width: 300,
    height: 200,
    dock: { x: 234, y: -32, z: -155, rotateX: 4, rotateY: -20, rotateZ: 4, scale: 0.66, opacity: 1 },
    scatter: { x: 540, y: -230, z: -470, rotateX: 16, rotateY: -48, rotateZ: 14, scale: 0.56, opacity: 0.2 },
  },
  {
    id: 'categories',
    Screen: CategoriesScreen,
    width: 320,
    height: 220,
    dock: { x: 178, y: 46, z: -70, rotateX: 2, rotateY: -14, rotateZ: 3, scale: 0.8, opacity: 1 },
    scatter: { x: 440, y: 170, z: -320, rotateX: 12, rotateY: -38, rotateZ: 10, scale: 0.68, opacity: 0.25 },
  },
  {
    id: 'registrations',
    Screen: RegistrationsScreen,
    width: 320,
    height: 220,
    dock: { x: -178, y: 36, z: -60, rotateX: 2, rotateY: 14, rotateZ: -3, scale: 0.82, opacity: 1 },
    scatter: { x: -440, y: -150, z: -300, rotateX: -10, rotateY: 36, rotateZ: -8, scale: 0.7, opacity: 0.25 },
  },
  {
    id: 'dashboard',
    Screen: DashboardScreen,
    width: 440,
    height: 300,
    hero: true,
    dock: { x: 0, y: 6, z: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, opacity: 1 },
    scatter: { x: 0, y: 60, z: -170, rotateX: 7, rotateY: -7, rotateZ: 0, scale: 0.88, opacity: 0.55 },
  },
];
