// Seed data migrated from the original tournament sheet.
// Each category has lettered brackets, each bracket a list of [player1, player2] doubles teams.
export const rawBrackets = {
  "WOMEN'S BEGINNER": {
    A: [
      ["Janice G. Gomez", "Nanine G. Gomez"],
      ["Mylet Igao", "Gracey Rodriguez"],
      ["Chean A. Frasco", "Jame Marcia A. Geñete"],
      ["Rica Mapait", "Gerda Pelayo"],
      ["Mardy Lepon", "Hannah Mae Barte"],
    ],
    B: [
      ["Nicole Joan D. Arbuyes", "Charlene Lord Aton"],
      ["Dawn Pearl Morados", "Zeallaine Jane Elnar"],
      ["Maria Arlett Sierra", "Ellise Jacobe"],
      ["Ethel Matela", "Ma Razzel Batoon"],
      ["Karin Krisha Cabrera", "Jenessa Genolaga"],
    ],
    C: [
      ["Marphy Limalima", "Karen Ursal"],
      ["Sheila Viloria", "Cary Alinday"],
      ["Ma. Nicole U. Mendiola", "Jobel Marie Aballe"],
      ["Rhea Jane Valles", "Cinde Cruz"],
      ["Kai Estelle Leyson", "Maribeth Dayota"],
    ],
    D: [
      ["Yesha Nicole Borres", "Chimberly Borres"],
      ["Stanley Briyce Batao", "Jade Unabia"],
      ["Susitte de la Torre", "Maria Gonzaga"],
      ["Niña Christy Melgazo", "Chrisanthea Camille Seno"],
      ["Jessa Orbiso-Duazo", "Carmel Lepiten"],
    ],
  },
  "MEN'S BEGINNER": {
    A: [
      ["Jan Mcklein Sarah", "Dony Claire Edesan"],
      ["Renzo M. Pedroza", "Joseph Roldan Escanilla"],
      ["Flex Y. Rodriguez", "Harlan James D. Hortelano"],
      ["Franz Pacheco", "Miko Pacheco"],
      ["Kenji Nailon", "Allen Nailon"],
    ],
    B: [
      ["Morries Karl Buselak", "John Paul Cuizon"],
      ["Cres Humprey Monleon", "Erickson Keith Gunhuran"],
      ["Algerie Orendain", "Jayvi John Cejano"],
      ["Heinrich Pinote", "Daniel Dwayne Solis"],
      ["Samson M. Lepiten", "Jegie Lequin"],
    ],
    C: [
      ["Dare Marty Solis", "Jose Kenneth Ymbong"],
      ["Joshua Del Rosario", "Zaijan Del Rosario"],
      ["Jason Limalima", "Reggie Campo"],
      ["Carl Palacio", "Sean Dy"],
      ["Dane Tethony Mansing", "Jade Pantaleon"],
    ],
    D: [
      ["Michael fabian", "Christian Gallarde"],
      ["Jude Bryan Ragual", "Alvy Nathaniel Legaria"],
      ["Jovan Valiente", "Arven Dave Baco"],
      ["Kristian Alec Ho", "John Dale"],
      ["Darcy Leonard Balaga", "Jared Morados"],
    ],
  },
  "MIXED DOUBLES": {
    A: [
      ["Eldie Anthony Lepon", "Emma Christina Lepon"],
      ["Kai Estelle Leyson", "Es-fer Basil Winlove Cuestas"],
      ["Samson M. Lepiten", "Ma. Nicole U. Mendiola"],
      ["Dare Marty Solis", "Lee Ann"],
      ["Jakelyn Neiz", "Jan Adriel Rosales"],
    ],
    B: [
      ["Heinrich Pinote", "Aubrey Fuentes"],
      ["Jose Kenneth Ymbong", "Rose Margarette Potestas"],
      ["John Carlo Trangia", "Halle Garner"],
      ["Bethel Dawn Ymalay", "Flex Rodriguez"],
      ["Yaphete John Cabalo", "Jenica Kristine Cabalo"],
    ],
    C: [
      ["Jegie Lequin", "Jobel Marie Aballe"],
      ["Vince David Lanzaderas", "Princess Loureen Ompoc"],
      ["Dawn Morados", "Jared Morados"],
      ["Phillip Russell S. Wahing", "Venus B. Tatoy"],
      ["Erick Kent G. Gunhuran", "Jesyvien Nicole R. Villarino"],
    ],
    D: [
      ["Rolex Espina", "Eldra Espina"],
      ["Danhel Lee Bongas", "Danhiecka Dhel Bongas"],
      ["Lester Jay Bacalla", "Cindy Aljean Bacalla"],
      ["Ricky Lahoylahoy", "Keysha Marie Anacleto"],
      ["Cody Rodriguez", "Micyle Rodriguez"],
    ],
  },
  "GENDERLESS INTERMEDIATE": {
    A: [
      ["Jude Daniel A. Matela", "Klate Vincent Jayme"],
      ["Joshua Olita", "Marc Loreto"],
      ["Andrew Pagatpat", "Martin Del Rosario"],
      ["Kaye Layosa", "Liam Chin Apura"],
      ["Sab Gian", "Roy Adrian Roble"],
    ],
    B: [
      ["Raymund Goco", "MC Prince Jumawan"],
      ["Everett Gil Fernan Niere", "Everett Pete Fernan Niere"],
      ["Kristine Acuna", "Julliegen Gastardo"],
      ["Niljun Navarro", "Junil Navarro"],
      ["Yvan L. Hinayon", "Ian Nilo S. Ursal"],
    ],
    C: [
      ["Arthfel Balane", "Reyniel Mata"],
      ["Zeun Paul S. Verallo", "Raymund Caezar Ian Goco"],
      ["Gabriel Andre N. Trazo", "Davis Dinoy"],
      ["Kent John B. Salgado", "Daryl Wayne Adolfo"],
      ["Russel Mart Bilocura", "Micheal Angeloo Nailon"],
    ],
    D: [
      ["Ervin Pet Suico", "Struart Torres"],
      ["Xavier Condor", "Christian Jay Nailon"],
      ["Jimmy Capin", "Mark Louie Bugtai"],
      ["James Kuizon", "Joshua Kuizon"],
      ["Ej Pasaol", "Polleen Veronique Lopez"],
    ],
  },
  "JUNIOR-SENIOR": {
    A: [
      ["Johndill Banday", "Ryndel John Albarina"],
      ["Edsel Orbiso", "Christine Orbiso"],
      ["Ervin Pet Suico", "Saf Pelaez"],
      ["Dhanemark Pagatpat", "Kayla Garner"],
      ["May Hipolito", "Zia Hipolito"],
    ],
    B: [
      ["Kenshin de la Torre", "Joseph Ramos"],
      ["Carlos Aton", "Charles Jay Aton"],
      ["Mariedith Lepon", "Kristine Stacey Tariman"],
      ["Kendrick Garner Pineda", "Donna Rose Pagatpat"],
      ["Rexanne Ygot Jr.", "Everett Enzo Niere"],
    ],
  },
};

export function buildInitialCategories() {
  return Object.entries(rawBrackets).map(([catName, bracketsObj]) => ({
    name: catName,
    brackets: Object.entries(bracketsObj).map(([letter, pairs]) => ({
      letter,
      teams: pairs.map((pair, idx) => ({
        id: idx,
        player1: pair[0].trim(),
        player2: pair[1].trim(),
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      })),
      matchHistory: [],
    })),
  }));
}
