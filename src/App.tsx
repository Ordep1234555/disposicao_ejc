import { useState } from 'react';
import { Upload, Play, Download } from 'lucide-react';
import Papa from 'papaparse';

interface Person {
  Nome: string;
  ID_Casal?: number | null;
  ID_Familia?: number | null;
  ID_Amigos?: number | null;
  ID_Atenção?: number;
  Papel?: number;
  Cor: string;
}

type SeatingMatrix = (Person | null)[][];

// --- Constantes de Configuração ---
const ROWS = 8;
const COLS = 10;
const BLOCKED_SEAT_COLUMN_INDEX = 3;
const BLOCKED_SEATS_LAST_ROW_COUNT = 6;
const BLOCKED_SEAT: Person = { Nome: 'X', Cor: 'Bloqueado' };
// ------------------------------------

const App = () => {
  const [data, setData] = useState<Person[]>([]);
  // MODIFICAÇÃO: Alterado para armazenar um array de matrizes
  const [seatings, setSeatings] = useState<SeatingMatrix[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const colorMap: Record<string, string> = {
    'Amarelo': '#FCD34D',
    'Azul': '#60A5FA',
    'Laranja': '#FB923C',
    'Rosa': '#F472B6',
    'Verde': '#4ADE80',
    'Vermelho': '#F87171',
    'Bloqueado': '#9CA3AF'
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('Carregando arquivo...');
    Papa.parse<Person>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        console.log('Dados carregados:', results.data);
        setData(results.data);
        setStatus(`${results.data.length} pessoas carregadas. Clique em "Distribuir" para começar.`);
        setSeatings([]); // Limpa distribuições antigas ao carregar novo arquivo
      },
      error: (error) => {
        setStatus(`Erro ao carregar arquivo: ${error.message}`);
      }
    });
  };

  const checkConflict = (person1: Person | null, person2: Person | null): boolean => {
    if (!person1 || !person2) return false;
    if (person1.Cor === 'Bloqueado' || person2.Cor === 'Bloqueado') return false;

    if (person1.ID_Casal && person1.ID_Casal === person2.ID_Casal) return true;
    if (person1.ID_Familia && person1.ID_Familia === person2.ID_Familia) return true;
    if (person1.ID_Amigos && person1.ID_Amigos === person2.ID_Amigos) return true;
    if (person1.ID_Atenção === 1 && person2.ID_Atenção === 1) return true;
    return false;
  };

  const getAdjacentPositions = (row: number, col: number, rows = ROWS, cols = COLS): [number, number][] => {
    const adjacent: [number, number][] = [];
    const directions: [number, number][] = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < cols) {
        adjacent.push([newRow, newCol]);
      }
    }
    return adjacent;
  };

  const canPlacePerson = (person: Person, row: number, col: number, currentSeating: SeatingMatrix): boolean => {
    if (person.ID_Atenção === 1 && row === (ROWS - 1)) return false;
    
    if (col === BLOCKED_SEAT_COLUMN_INDEX || currentSeating[row][col]?.Cor === 'Bloqueado') {
      return false;
    }

    const adjacent = getAdjacentPositions(row, col, ROWS, COLS);
    for (const [adjRow, adjCol] of adjacent) {
      const adjacentPerson = currentSeating[adjRow][adjCol];
      if (checkConflict(person, adjacentPerson)) {
        return false;
      }
    }
    
    return true;
  };

  // --- NOVA FUNÇÃO: Lógica para gerar UMA configuração ---
  const generateOneConfiguration = (
    peopleData: Person[], 
    ruleSet: 'default' | 'special'
  ): SeatingMatrix => {
      
    // Filtra os grupos de pessoas
    // Garantir que uma pessoa não caia em múltiplos grupos prioritários
    const Papel1 = peopleData.filter(p => p.Papel === 1);
    const atencao1 = data.filter(p => p.ID_Atenção === 1 && p.Papel !== 1);
    const atencao2 = data.filter(p => p.ID_Atenção === 2);
    const atencao3 = data.filter(p => p.ID_Atenção === 3);
    const others = data.filter(p => p.ID_Atenção !== 1 && p.ID_Atenção !== 2 && p.ID_Atenção !== 3);

    let matrix: SeatingMatrix = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    let placed = new Set<Person>();

    // --- Bloquear assentos (lógica movida para cá) ---
    for (let r = 0; r < ROWS; r++) {
      matrix[r][BLOCKED_SEAT_COLUMN_INDEX] = BLOCKED_SEAT;
    }
    const lastRowIndex = ROWS - 1;
    for (let c = BLOCKED_SEAT_COLUMN_INDEX + 1; c < COLS; c++) { 
      matrix[lastRowIndex][c] = BLOCKED_SEAT;
    }
    // --- Fim Bloquear assentos ---

    // --- MODIFICAÇÃO: tryPlacePerson agora aceita fileiras permitidas ---
    const tryPlacePerson = (person: Person, allowedRows?: number[]): boolean => {
      const positions: [number, number][] = [];
      // Se allowedRows não for fornecido, usa todas as fileiras
      const rowsToCheck = allowedRows ? allowedRows : Array.from({ length: ROWS }, (_, i) => i);

      for (const r of rowsToCheck) {
        for (let c = 0; c < COLS; c++) {
          if (!matrix[r][c]) { // Se o assento estiver vazio
            positions.push([r, c]);
          }
        }
      }
      
      positions.sort(() => Math.random() - 0.5);
      
      for (const [r, c] of positions) {
        if (canPlacePerson(person, r, c, matrix)) {
          matrix[r][c] = person;
          placed.add(person);
          return true;
        }
      }
      return false;
    };
    // --- Fim tryPlacePerson ---

    // --- LÓGICA DE ALOCAÇÃO ---

    const configName = ruleSet === 'special' ? `(Config 1)` : `(Config Padrão)`;

    if (ruleSet === 'special') {
      // 1. Alocar Papel1 (Papel === '1') na fileira 2 (índice 1)
      for (const person of Papel1) {
        if (!tryPlacePerson(person, [1])) { // [1] = apenas fileira de índice 1
          throw new Error(`${configName} Não foi possível colocar ${person.Nome} (1) na fileira 2`);
        }
      }
      // 2. Alocar Atenção 3 (ID_Atenção === 3) nas últimas 3 fileiras
      const lastThreeRows = [ROWS - 3, ROWS - 2, ROWS - 1];
      for (const person of atencao3) {
         if (!tryPlacePerson(person, lastThreeRows)) { 
          throw new Error(`${configName} Não foi possível colocar ${person.Nome} (Atenção 3) nas últimas 3 fileiras`);
        }
      }
    } else {
      // Regra 'default': Aloca Papel1 e Atenção 3 em qualquer lugar
      for (const person of Papel1) {
        if (!tryPlacePerson(person)) { 
          throw new Error(`${configName} Não foi possível colocar ${person.Nome} (1)`);
        }
      }
      for (const person of atencao3) {
         if (!tryPlacePerson(person)) { 
          throw new Error(`${configName} Não foi possível colocar ${person.Nome} (Atenção 3)`);
        }
      }
    }

    // 3. Colocar Atenção 1 (Moita) - Lógica normal
    for (const person of atencao1) {
      if (!tryPlacePerson(person)) { 
        throw new Error(`${configName} Não foi possível colocar ${person.Nome} (Atenção 1)`);
      }
    }

    // 4. Lógica de colocação do Atenção 2 - Lógica normal
    for (const person of atencao2) {
      let personPlaced = false;
      const possibleSeats: [number, number][] = [];

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (matrix[r][c] && matrix[r][c]!.ID_Atenção === 1 &&
              matrix[r][c]!.Papel !== 2 
          ) {
            const neighbours: [number, number][] = [];
            if (c - 1 >= 0) neighbours.push([r, c - 1]);
            if (c + 1 < COLS) neighbours.push([r, c + 1]);

            for (const [adjR, adjC] of neighbours) {
              if (!matrix[adjR][adjC] && canPlacePerson(person, adjR, adjC, matrix)) {
                possibleSeats.push([adjR, adjC]);
              }
            }
          }
        }
      }
      
      const uniqueSeats = [...new Set(possibleSeats.map(pos => `${pos[0]},${pos[1]}`))].map(pos => {
          const [r, c] = pos.split(',').map(Number);
          return [r, c] as [number, number];
      });
      
      uniqueSeats.sort(() => Math.random() - 0.5);

      for (const [r, c] of uniqueSeats) {
         if (!matrix[r][c]) { 
            matrix[r][c] = person;
            placed.add(person);
            personPlaced = true;
            break;
         }
      }

      if (!personPlaced) {
        throw new Error(`${configName} Não foi possível colocar ${person.Nome} (Atenção 2) adjacente a um ID_Atenção = 1`);
      }
    }
    
    // 5. Colocar os Outros - Lógica normal
    for (const person of others) {
      if (!tryPlacePerson(person)) {
        throw new Error(`${configName} Não foi possível colocar ${person.Nome}`);
      }
    }

    return matrix;
  };
  // --- Fim da função generateOneConfiguration ---


  // --- MODIFICAÇÃO: distributeSeating agora é o orquestrador ---
  const distributeSeating = () => {
    setLoading(true);
    setStatus('Gerando 4 configurações...');
    setSeatings([]); // Limpa resultados anteriores
    
    setTimeout(() => {
      try {
        const rows = ROWS;
        const cols = COLS;

        const totalBlockedSeats = rows + BLOCKED_SEATS_LAST_ROW_COUNT;
        const availableSeats = (rows * cols) - totalBlockedSeats;
        
        if (data.length > availableSeats) {
          setStatus(`Erro: ${data.length} pessoas para ${availableSeats} assentos disponíveis.`);
          setLoading(false);
          return;
        }
        
        const generatedMatrices: SeatingMatrix[] = [];
        const ruleSets: ('special' | 'default')[] = ['special', 'default', 'default', 'default'];
        
        for (let i = 0; i < ruleSets.length; i++) {
            // Gera uma matriz de cada vez
            const newMatrix = generateOneConfiguration(data, ruleSets[i]);
            generatedMatrices.push(newMatrix);
        }

        setSeatings(generatedMatrices);
        const peoplePlaced = generatedMatrices[0].flat().filter(p => p && p.Cor !== 'Bloqueado').length;
        setStatus(`✓ 4 configurações geradas! ${peoplePlaced} pessoas alocadas em ${availableSeats} assentos disponíveis.`);

      } catch (error) {
        setStatus(`Erro: ${(error as Error).message}. Tente novamente.`);
        setSeatings([]);
      }
      setLoading(false);
    }, 100);
  };

  // --- MODIFICAÇÃO: downloadImage agora aceita qual matriz baixar ---
  const downloadImage = (matrixToDownload: SeatingMatrix, configIndex: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellWidth = 120;
    const cellHeight = 80;
    const padding = 10;
    
    canvas.width = COLS * cellWidth + padding * 2;
    canvas.height = ROWS * cellHeight + padding * 2;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Usa a matriz específica (matrixToDownload) em vez do estado 'seating'
    matrixToDownload.forEach((row, r) => {
      row.forEach((person, c) => {
        const x = padding + c * cellWidth;
        const y = padding + r * cellHeight;
        
        if (person) {
          ctx.fillStyle = colorMap[person.Cor] || '#E5E7EB';
          ctx.fillRect(x, y, cellWidth - 2, cellHeight - 2);
          
          ctx.fillStyle = '#000000';
          if (person.Cor === 'Bloqueado') {
             ctx.fillText('X', x + cellWidth / 2, y + cellHeight / 2);
          } else {
             ctx.fillText(person.Nome || 'N/A', x + cellWidth / 2, y + cellHeight / 2);
          }

        } else {
          ctx.fillStyle = '#F3F4F6';
          ctx.fillRect(x, y, cellWidth - 2, cellHeight - 2);
        }
        
        ctx.strokeStyle = '#D1D5DB';
        ctx.strokeRect(x, y, cellWidth - 2, cellHeight - 2);
      });
    });
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Nome do arquivo agora inclui o índice da configuração
      a.download = `distribuicao_assentos_config_${configIndex + 1}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #EFF6FF 0%, #E0E7FF 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '2rem', textAlign: 'center' }}>
          Distribuição de Assentos
        </h1>
        
        <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1.5rem' }}>
           <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.75rem 1.5rem', 
              background: '#3B82F6', 
              color: 'white', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontWeight: '600'
            }}>
              <Upload size={20} />
              <span>Carregar CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
            
            <button
              onClick={distributeSeating}
              disabled={data.length === 0 || loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: data.length === 0 || loading ? '#D1D5DB' : '#10B981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: data.length === 0 || loading ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              <Play size={20} />
              <span>{loading ? 'Gerando...' : 'Gerar 4 Configurações'}</span>
            </button>
          </div>

          {/* --- MODIFICAÇÃO: Botões de Download dinâmicos --- */}
          {seatings.length > 0 && (
            <div style={{ 
              display: 'flex', 
              gap: '0.75rem', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              width: '100%', 
              marginTop: '1.5rem', 
              paddingTop: '1rem',
              borderTop: '1px solid #E5E7EB'
            }}>
              <span style={{fontWeight: 600, color: '#374151', alignSelf: 'center'}}>Baixar Imagem:</span>
              {seatings.map((seatingMatrix, index) => (
                <button
                  key={index}
                  onClick={() => downloadImage(seatingMatrix, index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem', // menores
                    background: '#8B5CF6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  <Download size={18} />
                  <span>Config. {index + 1}</span>
                </button>
              ))}
            </div>
          )}
          
          {status && (
            <p style={{ textAlign: 'center', color: '#374151', fontWeight: '500', marginTop: '1rem' }}>{status}</p>
          )}
        </div>

        {/* --- MODIFICAÇÃO: Renderiza todas as matrizes em 'seatings' --- */}
        {seatings.length > 0 && (
          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
            
            {/* Loop para cada configuração gerada */}
            {seatings.map((seating, configIndex) => (
              <div key={configIndex} style={{ marginBottom: '3rem' }}>
                <h2 style={{ 
                  fontSize: '1.8rem', 
                  fontWeight: 'bold', 
                  color: '#1F2937', 
                  marginBottom: '1rem', 
                  borderBottom: '2px solid #E5E7EB', 
                  paddingBottom: '0.5rem' 
                }}>
                  Configuração {configIndex + 1}
                  {configIndex === 0 && (
                    <span style={{ fontSize: '1rem', fontWeight: '500', color: '#4B5563', marginLeft: '1rem' }}>(Regras Especiais: Papel1 na F2, Atenção 3 nas 3 últimas)</span>
                  )}
                </h2>

                <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                  <div style={{ display: 'inline-block', minWidth: '100%' }}>
                    {seating.map((row, rowIndex) => (
                      <div key={rowIndex} style={{ display: 'flex' }}>
                        {row.map((person, colIndex) => {
                          const bgColor = person ? (colorMap[person.Cor] || '#E5E7EB') : '#F3F4F6';
                          return (
                            <div
                              key={`${rowIndex}-${colIndex}`}
                              style={{
                                width: '120px',
                                height: '80px',
                                border: '1px solid #D1D5DB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: '500',
                                textAlign: 'center',
                                padding: '5px',
                                backgroundColor: bgColor,
                                wordWrap: 'break-word'
                              }}
                            >
                              {person ? (person.Cor === 'Bloqueado' ? 'X' : person.Nome) : ''}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Legenda (mostrada apenas uma vez no final) */}
            <div style={{ marginTop: '2rem', borderTop: '1px solid #E5E7EB', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1F2937', marginBottom: '1rem' }}>Legenda de Cores:</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                {Object.entries(colorMap).map(([cor, hex]) => (
                  <div key={cor} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '4px',
                        border: '1px solid #D1D5DB',
                        backgroundColor: hex
                      }}
                    />
                    <span style={{ fontSize: '14px', color: '#374151' }}>{cor}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;