// Presentation-only correction: completion points do not imply a known actual start.
function localizeSchedule(svg,date){
  const labels=[...svg.querySelectorAll('.taskobo-gantt-status-legend text')];
  if(![3,4].includes(labels.length))throw new Error('工程表の凡例に互換性がない。');
  const lines=[
    '基準＝白抜き破線　完了実績＝完了日の菱形（実績開始日不明）　予測＝塗り破線の期間',
    '危険色＝完了遅延・期限超過　注意色＝将来の遅延見込み　強調色＝期限内予測　成功色＝期限内完了',
    `差＝実績・予測終了日 − 基準終了日（暦日）　集計基準日 ${date}`,
    '計画案＝淡色の点線　白抜き菱形＝未承認の判断予定・計画節目'
  ];
  labels.forEach((label,index)=>{
    const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    if(!nodes.length)throw new Error('工程表の凡例に文字ノードがない。');
    nodes[0].data=lines[index];for(const node of nodes.slice(1))node.data='';
  });
}
