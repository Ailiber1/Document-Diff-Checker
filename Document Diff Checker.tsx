import React, { useState } from 'react';
import { Upload, X, Download, CheckSquare, Square, AlertCircle, HelpCircle } from 'lucide-react';

const SpecDiffManager = () => {
  const [baseFile, setBaseFile] = useState(null);
  const [modifiedFile, setModifiedFile] = useState(null);
  const [baseContent, setBaseContent] = useState('');
  const [modifiedContent, setModifiedContent] = useState('');
  const [diffDetected, setDiffDetected] = useState(false);
  const [missingLines, setMissingLines] = useState([]);
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [mergedContent, setMergedContent] = useState('');
  const [stats, setStats] = useState({ same: 0, added: 0, deleted: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState('');
  const [downloadExtension, setDownloadExtension] = useState('txt');
  const [showHelpModal, setShowHelpModal] = useState(false);

  const extractTextFromFile = async (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    
    try {
      if (extension === 'txt' || extension === 'md') {
        return await file.text();
      } else {
        throw new Error(`未対応のファイル形式: .${extension} (現在は.txt, .mdのみ対応)`);
      }
    } catch (err) {
      throw new Error(`ファイル読み込みエラー: ${err.message}`);
    }
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      const content = await extractTextFromFile(file);
      
      if (type === 'base') {
        setBaseFile(file);
        setBaseContent(content);
      } else {
        setModifiedFile(file);
        setModifiedContent(content);
      }
      setDiffDetected(false);
      setMissingLines([]);
      setSelectedLines(new Set());
      setMergedContent('');
    } catch (err) {
      setError(err.message);
      if (type === 'base') {
        setBaseFile(null);
        setBaseContent('');
      } else {
        setModifiedFile(null);
        setModifiedContent('');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearFile = (type) => {
    if (type === 'base') {
      setBaseFile(null);
      setBaseContent('');
    } else {
      setModifiedFile(null);
      setModifiedContent('');
    }
    setDiffDetected(false);
    setMissingLines([]);
    setSelectedLines(new Set());
    setMergedContent('');
    setError('');
  };

  const detectDiff = () => {
    const baseLines = baseContent.split('\n');
    const modifiedLines = modifiedContent.split('\n');
    
    const modifiedSet = new Set(modifiedLines);
    const baseSet = new Set(baseLines);
    
    const missing = baseLines
      .map((line, index) => ({ id: index, line }))
      .filter(({ line }) => !modifiedSet.has(line) && line.trim() !== '');
    
    const sameLines = baseLines.filter(line => modifiedSet.has(line)).length;
    const deletedLines = missing.length;
    const addedLines = modifiedLines.filter(line => !baseSet.has(line) && line.trim() !== '').length;
    
    setMissingLines(missing);
    setStats({ same: sameLines, added: addedLines, deleted: deletedLines });
    setDiffDetected(true);
  };

  const toggleLine = (id) => {
    const newSelected = new Set(selectedLines);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLines(newSelected);
  };

  const selectAll = () => {
    setSelectedLines(new Set(missingLines.map(item => item.id)));
  };

  const deselectAll = () => {
    setSelectedLines(new Set());
  };

  const applyMerge = () => {
    const linesToAdd = missingLines.filter(item => selectedLines.has(item.id));
    
    if (linesToAdd.length === 0) {
      alert('反映する行が選択されていません');
      return;
    }

    const baseLines = baseContent.split('\n');
    const modifiedLines = modifiedContent.split('\n');

    const isHeading = (line) => {
      const trimmed = line.trim();
      return trimmed.startsWith('【') && trimmed.includes('】');
    };

    const lineToHeadingMap = new Map();
    let currentHeading = null;
    
    baseLines.forEach((line, index) => {
      if (isHeading(line)) {
        currentHeading = line.trim();
      }
      lineToHeadingMap.set(index, currentHeading);
    });

    const headingPositions = new Map();
    modifiedLines.forEach((line, index) => {
      if (isHeading(line)) {
        const heading = line.trim();
        if (!headingPositions.has(heading)) {
          headingPositions.set(heading, []);
        }
        headingPositions.get(heading).push(index);
      }
    });

    const headingGroups = new Map();
    const orphanLines = [];

    linesToAdd.forEach(item => {
      const heading = lineToHeadingMap.get(item.id);
      
      if (heading && headingPositions.has(heading)) {
        if (!headingGroups.has(heading)) {
          headingGroups.set(heading, []);
        }
        headingGroups.get(heading).push(item.line);
      } else {
        orphanLines.push(item.line);
      }
    });

    let resultLines = [...modifiedLines];
    let offset = 0;

    headingGroups.forEach((lines, heading) => {
      const positions = headingPositions.get(heading);
      if (positions && positions.length > 0) {
        const lastHeadingPos = positions[positions.length - 1];
        
        let insertPos = lastHeadingPos + 1 + offset;
        for (let i = lastHeadingPos + 1; i < modifiedLines.length; i++) {
          if (isHeading(modifiedLines[i])) {
            insertPos = i + offset;
            break;
          }
          if (i === modifiedLines.length - 1) {
            insertPos = i + 1 + offset;
          }
        }

        resultLines.splice(insertPos, 0, ...lines);
        offset += lines.length;
      }
    });

    if (orphanLines.length > 0) {
      resultLines.push('');
      resultLines.push('---');
      resultLines.push('[Auto-Appended Missing Blocks]');
      resultLines.push('');
      resultLines.push(...orphanLines);
    }

    const merged = resultLines.join('\n');
    setMergedContent(merged);
  };

  const downloadFile = () => {
    const defaultName = mergedContent ? '完成版ドキュメント' : '修正版ドキュメント';
    setDownloadFileName(defaultName);
    setDownloadExtension('txt');
    setShowDownloadModal(true);
  };

  const executeDownload = () => {
    const content = mergedContent || modifiedContent;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${downloadFileName}.${downloadExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-center mb-8 relative">
          <h1 className="text-3xl font-bold">ドキュメント差分チェッカー</h1>
          <button
            onClick={() => setShowHelpModal(true)}
            className="absolute right-0 p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition"
            title="使い方を見る"
          >
            <HelpCircle size={24} className="text-blue-400" />
          </button>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <div className="font-semibold text-red-200">エラー</div>
              <div className="text-red-300 text-sm">{error}</div>
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. ファイルアップロード</h2>
          <div className="mb-4 text-sm text-gray-400">
            対応形式: .txt, .md
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-4">
              <label className="block mb-2 font-medium">元のドキュメント（ベース）</label>
              {!baseFile ? (
                <label className="flex items-center justify-center cursor-pointer bg-gray-700 hover:bg-gray-600 rounded p-4">
                  <Upload className="mr-2" size={20} />
                  <span>{loading ? '読み込み中...' : 'ファイルを選択'}</span>
                  <input 
                    type="file" 
                    accept=".txt,.md" 
                    onChange={(e) => handleFileUpload(e, 'base')} 
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between bg-gray-700 rounded p-3">
                  <span className="truncate">{baseFile.name}</span>
                  <button onClick={() => clearFile('base')} className="ml-2 text-red-400 hover:text-red-300">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>

            <div className="border-2 border-dashed border-gray-600 rounded-lg p-4">
              <label className="block mb-2 font-medium">修正版ドキュメント（最新版）</label>
              {!modifiedFile ? (
                <label className="flex items-center justify-center cursor-pointer bg-gray-700 hover:bg-gray-600 rounded p-4">
                  <Upload className="mr-2" size={20} />
                  <span>{loading ? '読み込み中...' : 'ファイルを選択'}</span>
                  <input 
                    type="file" 
                    accept=".txt,.md" 
                    onChange={(e) => handleFileUpload(e, 'modified')} 
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between bg-gray-700 rounded p-3">
                  <span className="truncate">{modifiedFile.name}</span>
                  <button onClick={() => clearFile('modified')} className="ml-2 text-red-400 hover:text-red-300">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={detectDiff}
            disabled={!baseFile || !modifiedFile || loading}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
          >
            差分を検知
          </button>

          {diffDetected && (
            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-green-400">{stats.same}</div>
                <div className="text-sm text-gray-400">同一行数</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-blue-400">{stats.added}</div>
                <div className="text-sm text-gray-400">追加行数</div>
              </div>
              <div className="bg-gray-700 rounded p-3">
                <div className="text-2xl font-bold text-red-400">{stats.deleted}</div>
                <div className="text-sm text-gray-400">削除行数</div>
              </div>
            </div>
          )}
        </div>

        {diffDetected && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">2. 抜け候補一覧（{missingLines.length}件）</h2>
            
            <div className="flex gap-2 mb-4">
              <button onClick={selectAll} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                全選択
              </button>
              <button onClick={deselectAll} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
                全解除
              </button>
            </div>

            <div className="bg-gray-700 rounded-lg max-h-96 overflow-y-auto">
              {missingLines.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  抜け候補はありません
                </div>
              ) : (
                missingLines.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleLine(item.id)}
                    className="flex items-start gap-3 p-3 border-b border-gray-600 hover:bg-gray-600 cursor-pointer"
                  >
                    <div className="mt-1">
                      {selectedLines.has(item.id) ? (
                        <CheckSquare size={20} className="text-blue-400" />
                      ) : (
                        <Square size={20} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-gray-400 mr-2">#{item.id}</span>
                      <span className="font-mono text-sm">{item.line}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={applyMerge}
              disabled={selectedLines.size === 0}
              className="mt-4 w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
            >
              選択分を反映（{selectedLines.size}件）
            </button>
          </div>
        )}

        {diffDetected && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">3. 差分プレビュー</h2>
            <div className="bg-gray-900 rounded p-4 font-mono text-sm max-h-64 overflow-y-auto">
              {missingLines.slice(0, 20).map((item) => (
                <div key={item.id} className={selectedLines.has(item.id) ? 'text-green-400' : 'text-red-400'}>
                  {selectedLines.has(item.id) ? '+ ' : '- '}{item.line}
                </div>
              ))}
              {missingLines.length > 20 && (
                <div className="text-gray-500 mt-2">... 他 {missingLines.length - 20} 行</div>
              )}
            </div>
          </div>
        )}

        {mergedContent && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">4. 反映後プレビュー</h2>
            <div className="bg-gray-900 rounded p-4 font-mono text-sm max-h-96 overflow-y-auto whitespace-pre-wrap">
              {mergedContent.split('\n').map((line, index) => {
                const trimmed = line.trim();
                const isHeading = trimmed.startsWith('【') && trimmed.includes('】');
                const isMarker = line === '---' || line === '[Auto-Appended Missing Blocks]';
                const isAddedLine = missingLines.some(item => 
                  selectedLines.has(item.id) && item.line === line
                );

                if (isMarker) {
                  return (
                    <div key={index} className="text-yellow-400 border-t border-yellow-600 mt-2 pt-2">
                      {line}
                    </div>
                  );
                }

                if (isAddedLine) {
                  return (
                    <div key={index} className="bg-green-900 bg-opacity-30 text-green-300 border-l-2 border-green-500 pl-2">
                      {line}
                    </div>
                  );
                }

                if (isHeading) {
                  return (
                    <div key={index} className="text-blue-400 font-bold mt-2">
                      {line}
                    </div>
                  );
                }

                return (
                  <div key={index} className="text-gray-300">
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(diffDetected || mergedContent) && (
          <div className="bg-gray-800 rounded-lg p-6">
            <button
              onClick={downloadFile}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-4 rounded-lg transition flex items-center justify-center gap-2"
            >
              <Download size={24} />
              <span>保存（DL）</span>
            </button>
          </div>
        )}

        {showDownloadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold mb-4">ファイルをダウンロード</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">ファイル名</label>
                <input
                  type="text"
                  value={downloadFileName}
                  onChange={(e) => setDownloadFileName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="ファイル名を入力"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">拡張子</label>
                <select
                  value={downloadExtension}
                  onChange={(e) => setDownloadExtension(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="txt">.txt</option>
                  <option value="md">.md</option>
                  <option value="log">.log</option>
                  <option value="csv">.csv</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={executeDownload}
                  disabled={!downloadFileName.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition"
                >
                  ファイルをダウンロード
                </button>
              </div>
            </div>
          </div>
        )}

        {showHelpModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowHelpModal(false)}>
            <div className="bg-gray-800 rounded-lg max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                <h3 className="text-xl font-bold">使い方ガイド</h3>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="text-gray-400 hover:text-white p-2 hover:bg-gray-700 rounded-full transition"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="overflow-y-auto p-4 flex-1">
                <div className="space-y-4 text-sm">
                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-xs">1</div>
                      <h4 className="font-semibold">ファイルアップロード</h4>
                    </div>
                    <p className="text-gray-300 text-xs ml-8">
                      元と修正版の2つをアップロード (.txt, .md)
                    </p>
                  </div>

                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-xs">2</div>
                      <h4 className="font-semibold">差分を検知</h4>
                    </div>
                    <p className="text-gray-300 text-xs ml-8">
                      2つのファイルを比較して統計を表示
                    </p>
                  </div>

                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-xs">3</div>
                      <h4 className="font-semibold">抜け候補を選択</h4>
                    </div>
                    <p className="text-gray-300 text-xs ml-8">
                      修正版で削除された行から復元したいものを選択
                    </p>
                  </div>

                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-xs">4</div>
                      <h4 className="font-semibold">反映して確認</h4>
                    </div>
                    <p className="text-gray-300 text-xs ml-8 mb-2">
                      選択した行を修正版に追加
                    </p>
                    <div className="ml-8 bg-gray-800 rounded p-2 text-xs">
                      <div className="text-yellow-400 font-semibold mb-1">💡 スマート配置</div>
                      <div className="text-gray-300">
                        【見出し】配下にあった行は同じ見出しの下に自動配置されます
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-xs">5</div>
                      <h4 className="font-semibold">ダウンロード</h4>
                    </div>
                    <p className="text-gray-300 text-xs ml-8">
                      完成版をファイル名と拡張子を指定してDL
                    </p>
                  </div>

                  <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-3">
                    <div className="font-semibold text-blue-300 mb-1 text-xs">💡 ヒント</div>
                    <ul className="text-gray-300 text-xs space-y-1">
                      <li>• 追加箇所は<span className="text-green-400">緑色</span>で表示</li>
                      <li>• 見出し（【】）は<span className="text-blue-400">青色</span>で表示</li>
                      <li>• ×ボタンでファイル削除可能</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-700 flex-shrink-0">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg transition"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpecDiffManager;