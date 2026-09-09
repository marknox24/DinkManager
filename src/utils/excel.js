import * as XLSX from 'xlsx';

export function exportTournamentToExcel(categoriesData, tournamentName) {
  const workbook = XLSX.utils.book_new();
  for (const category of categoriesData) {
    const rows = [];
    for (const bracket of category.brackets) {
      for (const match of bracket.matchHistory) {
        rows.push({
          Bracket: bracket.letter,
          'Team A': match.teamA,
          'Team B': match.teamB,
          'Score A': match.scoreA,
          'Score B': match.scoreB,
          Winner: match.winner,
          Timestamp: match.timestamp,
        });
      }
    }
    if (rows.length === 0) {
      rows.push({ Bracket: 'No matches', 'Team A': '', 'Team B': '', 'Score A': '', 'Score B': '', Winner: '', Timestamp: '' });
    }
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 25 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, sheet, category.name.substring(0, 31));
  }
  const safeName = (tournamentName || 'Pickleball').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
  XLSX.writeFile(workbook, `${safeName}_History_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`);
}

export function downloadPlayersTemplate() {
  const rows = [{ 'Player 1 Name': 'Jane Doe', 'Player 2 Name': 'John Smith', 'Club Name': 'Riverside Club', Email: '', Phone: '' }];
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 25 }, { wch: 16 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Players');
  XLSX.writeFile(workbook, 'DinkManager_player_import_template.xlsx');
}

export function parsePlayersWorkbook(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return json
    .map((row) => ({
      player1: String(row['Player 1 Name'] || '').trim(),
      player2: String(row['Player 2 Name'] || '').trim(),
      club: String(row['Club Name'] || '').trim(),
      email: String(row['Email'] || '').trim(),
      phone: String(row['Phone'] || '').trim(),
    }))
    .filter((r) => r.player1);
}
