/** Catalog audited against the locally bundled Mermaid package, not a promise
 * that future Mermaid releases or every parameter have identical behavior. */
export {MERMAID_VERSION} from './version.mjs';

const base = {palette:'partial',fontSize:'partial',radius:'none',lineWidth:'partial',curve:'none',density:'none',direction:'none',transparent:'full'};
const entry = (id,label,source,controls={},status='stable',notes=[]) => Object.freeze({id,label,source,status,capabilities:Object.freeze({...base,...controls}),notes:Object.freeze(notes)});
const semantic = '形・矢印・軸の意味を保ち、各図のテーマ設定に配色と文字を適用します。';
const wideReading = '横に長い文書です。文字が小さい場合は読みやすい倍率に上げ、図の中を横スクロールして確認してください。';
const tallReading = '縦に長い文書です。全体の分岐を確認した後、読める倍率で図の中を縦スクロールしてください。';

export const DIAGRAM_CATALOG = Object.freeze([
  entry('flowchart','フローチャート',`flowchart TB
  %% 顧客対応システム・変更審査の架空例。2026/10/14、SMS追加は審査待ち。
  Request["SMS通知の追加申請<br/>見積 +8人日・+60万円"]:::anchor --> Record["PM：変更台帳に登録<br/>現在の基準は変更しない"]:::normal
  Record --> Evidence{"影響評価の資料は十分？"}:::decision
  Evidence -->|不足| Amend["申請者へ差し戻し<br/>効果・対象データを補足"]:::pending
  Amend --> Record
  Evidence -->|十分| Assess["開発・業務・情報管理が評価<br/>日程／費用／個人情報"]:::normal
  Assess --> Safe{"安全性・運用条件を満たす？"}:::decision
  Safe -->|未達| Revise["対策を設計し再評価<br/>承認だけで条件を免除しない"]:::blocked
  Revise --> Assess
  Safe -->|達成見込み| Decide{"スポンサー：10/16変更会議"}:::decision
  Decide -->|却下| Reject["理由・代替策を通知<br/>申請を却下で閉じる"]:::neutral
  Decide -->|保留| Hold["決定者・再審査期限を記録<br/>実装は着手しない"]:::pending
  Hold --> Evidence
  Decide -->|条件付き承認| Baseline["範囲・予算・計画を改訂<br/>関係者へ新基準を通知"]:::normal
  Baseline --> Verify["実装・独立検証<br/>受入条件と証跡を確認"]:::normal
  Verify --> Accept{"業務責任者が受入可能？"}:::decision
  Accept -->|未達| Fix["不具合／残課題を登録<br/>修正・再検証"]:::blocked
  Fix --> Verify
  Accept -->|合格| Close["変更を完了で閉じる<br/>運用手順・利用者案内も更新"]:::success`,{palette:'full',fontSize:'full',radius:'full',lineWidth:'full',curve:'full',density:'full',direction:'full'},'stable',['変更の登録、資料不足、安全性の未達、保留・却下、条件付き承認、受入時の手戻りを含む架空例です。10/14時点のSMS追加は未承認で、承認済みの基準に含みません。',tallReading]),
  entry('sequence','シーケンス図',`sequenceDiagram
  autonumber
  participant User as 業務担当
  participant App as 顧客対応システム
  participant Queue as 再送キュー
  participant CRM as CRM API
  participant Ops as 開発・運用担当
  Note over User,Ops: 架空設計例／2026-10-14：サンドボックスの401調査中。処理成功の実績ではない。
  User->>App: 対応履歴を登録
  App->>App: 権限・入力・一意な要求IDを検証
  App->>App: ローカルへ履歴を保存し連携待ちを記録
  App->>CRM: 同一要求IDで連携を要求
  alt 正常応答とCRM側IDを受領
    CRM-->>App: 受付済み・CRM側ID
    App->>App: 連携済みに更新・監査記録
    App-->>User: 登録・連携完了
  else 401・認証拒否
    CRM-->>App: 401 Unauthorized
    App->>Ops: 認証障害を通知・資格情報はログに出さない
    App-->>User: 登録済み／外部連携は保留
    Note over App,Ops: 無制限再送を停止。資格情報の確認後に担当者が再開判断。
  else 応答タイムアウト・結果が不明
    App->>Queue: 要求ID・試行回数・次回時刻を保存
    App-->>User: 結果確認中・再起票は不要
    Queue->>CRM: 要求IDで処理済みか照会
    alt CRM側で既に処理済み
      CRM-->>Queue: 既存CRM側IDを返す
      Queue->>App: 結果を照合・連携済みに確定
    else 未処理を確認・再送枠内
      Queue->>CRM: 同一要求IDで制御された再送
      CRM-->>Queue: 受付結果
      Queue->>App: 監査記録と状態を更新
    else 再送上限／照合不一致
      Queue->>Ops: 手動照合を依頼・自動処理停止
      Ops->>App: 補正／補償の対象と承認を記録
      App-->>User: 保留理由・次回連絡予定を通知
    end
  end`,{palette:'full',fontSize:'full',radius:'partial',lineWidth:'full'},'stable',['正常応答だけでなく、401、結果不明のタイムアウト、処理済み照会、冪等な再送、上限到達時の手動補正を分けます。再送制御は設計例で、現時点のAPI受入合格を意味しません。','角の丸みは参加者・注釈・活性区間に適用します。メッセージ線は直線です。',tallReading]),
  entry('state','状態遷移図',`stateDiagram-v2
  direction TB
  [*] --> Registered
  state "登録済み" as Registered
  state "着手条件待ち" as Ready
  state "対応中" as Working
  state "ブロックあり" as Blocked
  state "レビュー待ち" as Review
  state "修正中" as Rework
  state "受入待ち" as Acceptance
  state "完了" as Done
  state "再オープン審査" as Reopen
  state "中止" as Cancelled
  Registered --> Ready: 担当・期限・受入条件を登録
  Ready --> Working: 入力と必要権限がそろう
  Working --> Blocked: API認証／外部依存で停止
  Blocked --> Working: 解消証跡と再開条件を確認
  Working --> Review: 成果物と検証結果を提出
  Review --> Rework: 観点漏れ／不具合あり
  Rework --> Review: 修正・再検証を提出
  Review --> Acceptance: 独立確認を合格
  Acceptance --> Rework: 業務条件に未達
  Acceptance --> Done: 業務責任者が証跡を受領
  Done --> Reopen: 完了後に欠陥を発見
  Reopen --> Rework: 同一範囲の修正を承認
  Reopen --> Done: 別変更として台帳へ引継ぎ
  Ready --> Cancelled: 中止を承認・理由を通知
  Blocked --> Cancelled: 継続不可を判断
  Cancelled --> [*]
  class Registered,Ready neutral
  class Working,Rework normal
  class Review,Acceptance,Reopen pending
  class Blocked blocked
  class Done success`,{palette:'full',fontSize:'full',radius:'full',lineWidth:'full',direction:'full'},'stable',['対応中とブロックありを区別し、レビュー差し戻し、業務受入の未達、完了後の再オープンと中止を示します。「完了」はコード作成ではなく証跡の受領が条件です。','配置方向は新版の状態図に適用します。線の経路は状態図の規則に従います。']),
  entry('gantt','ガントチャート',`gantt\n  title 基準と実績・予測の比較（架空）\n  dateFormat YYYY-MM-DD\n  axisFormat %m/%d\n  todayMarker off\n  %% taskobo-gantt-status {"schema":"taskobo.gantt-status/v1","calendar":"calendar-days","asOf":"2026-10-14","statusMarker":"status_date","items":[{"baseline":"b_req","current":"a_req","baselineEnd":"2026-10-08","finish":"2026-10-10","stage":"done"},{"baseline":"b_api","current":"f_api","baselineEnd":"2026-10-12","finish":"2026-10-18","stage":"forecast"},{"baseline":"b_data","current":"f_data","baselineEnd":"2026-10-20","finish":"2026-10-23","stage":"forecast"}]}\n  section 集計基準日\n  集計基準日 10/14 :milestone, status_date, 2026-10-14, 0d\n  section 要件合意\n  基準終了 10/08 :b_req, 2026-10-01, 2026-10-08\n  実績終了 10/10・遅延確定 +2日 :done, a_req, 2026-10-01, 2026-10-10\n  section API接続\n  基準終了 10/12 :b_api, 2026-10-06, 2026-10-12\n  予測終了 10/18・期限超過 +6日 :active, f_api, 2026-10-06, 2026-10-18\n  section データ移行\n  基準終了 10/20 :b_data, 2026-10-09, 2026-10-20\n  予測終了 10/23・遅延見込み +3日 :active, f_data, 2026-10-09, 2026-10-23`,{palette:'full',fontSize:'full',radius:'partial',lineWidth:'partial'},'stable',['空心破線＝基準、塗り実線＝完了実績、塗り破線＝完了予測。差は実績・予測終了日と基準終了日の差（土日祝を含む暦日）です。','危険色＝完了遅延・期限超過。注意色＝将来遅延の見込み・リスク。crit は重点管理を示し、遅延とは区別します。','角の丸みはタスクバーに適用します。依存関係とマイルストーンの意味は維持します。']),
  entry('class','クラス図',`classDiagram
  direction LR
  class Customer {
    +UUID customerId
    +String displayName
    +Boolean consentRecorded
  }
  class ServiceCase {
    +UUID caseId
    +String status
    +DateTime slaDueAt
    +assignTo(staffId)
    +requestApproval()
    +closeWithEvidence()
  }
  class Staff {
    +UUID staffId
    +String role
    +Boolean active
    +canAccess(caseId) Boolean
  }
  class CaseEvent {
    +UUID eventId
    +DateTime recordedAt
    +String action
    +String beforeAfterDigest
  }
  class Approval {
    +UUID approvalId
    +String decision
    +String rejectionReason
    +decide(approverId)
  }
  class IntegrationAttempt {
    +UUID requestId
    +int attemptCount
    +String externalId
    +String state
    +retryWithSameRequestId()
    +holdForReconciliation()
  }
  Customer "1" --> "0..*" ServiceCase : 問い合わせ元
  Staff "0..1" <-- "0..*" ServiceCase : 担当割当
  ServiceCase "1" *-- "1..*" CaseEvent : 履歴を追記
  ServiceCase "1" *-- "0..*" Approval : 承認と差し戻し
  Staff "1" --> "0..*" Approval : 最終判断
  ServiceCase "1" *-- "0..*" IntegrationAttempt : 外部連携
  note for IntegrationAttempt "要求IDは一意／再送でも維持<br/>結果不明を成功扱いしない"
  note for CaseEvent "監査履歴は追記型<br/>個人情報の値を無条件に記録しない"`,{radius:'partial'},'stable',['顧客・案件・担当者・履歴・承認・外部連携試行の責務と多重度を示す架空の論理モデルです。排他制御や認可は別の実装・検証が必要で、図だけで保証されません。',semantic]),
  entry('er','ER 図',`erDiagram
  CUSTOMER ||--o{ SERVICE_CASE : raises
  STAFF o|--o{ SERVICE_CASE : assigned_to
  SERVICE_CASE ||--|{ CASE_EVENT : records
  SERVICE_CASE ||--o{ APPROVAL : requests
  STAFF ||--o{ APPROVAL : decides
  SERVICE_CASE ||--o{ INTEGRATION_ATTEMPT : synchronizes
  CUSTOMER {
    uuid customer_id PK
    string source_key UK "source + external key unique"
    string display_name "access restricted"
    boolean consent_recorded
  }
  STAFF {
    uuid staff_id PK
    string login_id UK
    string role "4 roles"
    boolean is_active
  }
  SERVICE_CASE {
    uuid case_id PK
    uuid customer_id FK
    uuid assignee_id FK "nullable until triage"
    string status "blocked != complete"
    datetime sla_due_at
    int lock_version "optimistic locking"
  }
  CASE_EVENT {
    uuid event_id PK
    uuid case_id FK
    datetime recorded_at
    string action "append only"
    string actor_ref "retain audit identity"
  }
  APPROVAL {
    uuid approval_id PK
    uuid case_id FK
    uuid approver_id FK
    string decision "pending approved rejected"
    string reason "required on rejection"
  }
  INTEGRATION_ATTEMPT {
    uuid request_id PK "idempotency key"
    uuid case_id FK
    string external_id "nullable while unknown"
    int attempt_count
    string state "queued confirmed held"
  }`,{radius:'partial'},'stable',['同じ顧客対応システムの論理データモデル。未割当、未回答の承認、結果不明の連携をNULLや状態として区別します。型・制約・保持期間は設計例で、DB固有のDDLではありません。',semantic,wideReading]),
  entry('git','Git ブランチ図',`gitGraph
  commit id: "v0.8-baseline"
  branch develop
  checkout develop
  commit id: "integration-start"
  branch feature-retry
  checkout feature-retry
  commit id: "retry-control"
  commit id: "duplicate-test-failed" type: HIGHLIGHT
  commit id: "idempotency-fix"
  checkout main
  branch hotfix-auth
  checkout hotfix-auth
  commit id: "auth-fix"
  commit id: "hotfix-regression"
  checkout main
  merge hotfix-auth id: "v0.8.1" tag: "urgent-fix"
  checkout develop
  merge main id: "backport-hotfix"
  merge feature-retry id: "retry-review-passed"
  commit id: "integration-regression"
  checkout main
  merge develop id: "release-candidate" tag: "await-UAT"`,{},'stable',['今後の対応を想定した構成管理の架空例です。10/14時点は認証調査中。機能開発中の試験失敗、認証hotfixの先行、developへの取り込みと回帰試験を示します。release-candidateは業務受入待ちで、本番公開済みを意味しません。','ブランチに共通の系列色を適用します。コミットと分岐の意味は保ちます。']),
  entry('journey','ユーザージャーニー',`journey
  title 問い合わせ対応の体験仮説（架空・検証前）
  section 受付・担当調整
    相談内容を入力: 3: 受付担当
    顧客履歴を検索: 4: 受付担当
    重複の疑いで確認待ち: 1: 受付担当, 業務責任者
    担当窓口を決定: 3: 業務責任者
  section 調査・外部連携
    回答案と根拠を準備: 3: 受付担当
    CRM認証エラーで停止: 1: 受付担当, 運用担当
    保留理由と連絡予定を案内: 2: 受付担当
    復旧後に連携結果を照合: 3: 運用担当
  section 承認・再確認
    回答案の承認を依頼: 3: 受付担当, 業務責任者
    根拠不足で差し戻し: 1: 業務責任者
    補足して再承認を依頼: 2: 受付担当
    顧客へ回答し履歴を確認: 4: 受付担当
  section 終了・改善
    未回答を翌日に引き継ぐ: 2: 受付担当, 運用担当
    差し戻しの原因をレビュー: 3: 業務責任者, 運用担当`,{},'stable',['3役割・4段階の体験仮説。点数1〜5は説明用の主観値で、実測の満足度ではありません。認証障害、差し戻し、引継ぎの負担から改善箇所を検討します。',semantic,wideReading]),
  entry('pie','円グラフ',`pie showData
  title 先行検証30テストケースの状態（架空・2026/10/14）
  "合格" : 18
  "失敗・修正と再検証が必要" : 5
  "ブロック・実行条件待ち" : 4
  "未実施" : 3`,{lineWidth:'full'},'stable',['分母30テストケースの同一時点の内訳です。合格18、失敗5、ブロック4、未実施3。残り12を完了扱いせず、合格率60%をプロジェクト全体の進捗率とは解釈しません。','扇形と凡例を番号でも対応付け、色だけに頼らず区別します。角の丸み・接続線・配置方向は対象外です。']),
  entry('quadrant','四象限図',`quadrantChart
  title ステークホルダー対応方針（架空の主観評価）
  x-axis 関心が低い --> 関心が高い
  y-axis 影響力が低い --> 影響力が高い
  quadrant-1 密接に連携
  quadrant-2 満足を維持
  quadrant-3 変化を把握
  quadrant-4 情報と相談機会
  スポンサー: [0.76,0.92]
  業務責任者: [0.91,0.73]
  情報管理責任者: [0.29,0.88]
  運用責任者: [0.86,0.56]
  CRMベンダー: [0.40,0.66]
  品質責任者: [0.64,0.64]
  窓口代表A: [0.77,0.28]
  夜間当番候補: [0.87,0.11]
  関連部門: [0.16,0.21]
  利用部門長: [0.12,0.73]`,{},'stable',['10主体の配置はPMの仮説で、数値は測定値でも序列でもありません。低関心でも安全判断権限のある責任者を外さず、夜間当番候補の懸念を個別に確認します。',semantic]),
  entry('xychart','XY グラフ',`xychart-beta
  title "先行検証30テストケース・状態別件数（架空・10/14）"
  x-axis ["合格", "失敗", "ブロック", "未実施"]
  y-axis "テストケース数・合計30" 0 --> 20
  bar [18, 5, 4, 3]`,{},'stable',['円グラフと同じ30テストケースを共通の0起点で比較します。棒の高さは件数で、失敗・ブロック・未実施は別の対応が必要です。日ごとの増減や工数を表した図ではありません。',semantic]),
  entry('requirement','要求図',`requirementDiagram
  requirement business_acceptance {
    id: REQ01
    text: "必須30テストケース全件合格・重大未解決0"
    risk: high
    verifymethod: test
  }
  requirement migration_traceability {
    id: REQ02
    text: "20000件を移行先又は承認除外へ追跡可能"
    risk: high
    verifymethod: analysis
  }
  requirement retry_integrity {
    id: REQ03
    text: "同一要求IDの再送で二重登録0"
    risk: high
    verifymethod: test
  }
  requirement safe_recovery {
    id: REQ04
    text: "照合失敗又は時間枠超過時は停止・復旧検証・通知"
    risk: high
    verifymethod: demonstration
  }
  element customer_service_system {
    type: application
  }
  element acceptance_evidence {
    type: "業務受入記録・現在18合格ほか12未達"
  }
  element reconciliation_evidence {
    type: "照合記録・重複候補80件は判断待ち"
  }
  element retry_evidence {
    type: "障害系試験・401調査後に再検証"
  }
  element recovery_evidence {
    type: "切戻し演習記録・実施前"
  }
  customer_service_system - satisfies -> business_acceptance
  customer_service_system - satisfies -> migration_traceability
  customer_service_system - satisfies -> retry_integrity
  customer_service_system - satisfies -> safe_recovery
  acceptance_evidence - verifies -> business_acceptance
  reconciliation_evidence - verifies -> migration_traceability
  retry_evidence - verifies -> retry_integrity
  recovery_evidence - verifies -> safe_recovery`,{radius:'partial'},'stable',['4要求を実装対象・確認証跡に対応させる予定のトレーサビリティ図です。satisfies／verifiesは設計上の対応関係で、検証済みの主張ではありません。現時点の未達・実施前を証跡要素に明記しています。',semantic,wideReading]),
  entry('timeline','タイムライン',`timeline
  title 顧客対応システム導入・判断ロードマップ（架空）
  section 先行検証・10月
    10/14の現在地 : API認証調査中 : 重複候補80件は判断待ち
    10/16の判断予定 : SMS追加は承認／保留／却下を決定 : 要員競合の代替案を判断
  section 実施計画案・10月下旬〜11月
    計画基準の承認 : 範囲と受入条件を合意 : 先行検証の差異を反映して承認
    実装・結合検証 : 並行作業と依存を管理 : 重大不具合は修正・再検証
  section 受入・12月の切替目標
    Go／No Goの判断 : 必須30件の合格確認 : データ照合を確認 : 未達なら公開延期
    利用の少ない時間帯の切替 : 停止案内・バックアップ・検証 : 異常時は切戻しと復旧通知
  section 稼働後
    運用受領 : 主／備の窓口と未完事項を受領 : 初期支援と効果確認`,{},'stable',['10/14の事実と今後の予定を分け、判断条件・延期・切戻しを含めます。月区分はロードマップの説明で、30項目ガントチャートの依存計算結果や再承認を置き換えるものではありません。',semantic,wideReading]),
  entry('mindmap','マインドマップ',`mindmap
  root((顧客対応システム<br/>導入の確認領域))
    業務・範囲
      3窓口・40名の利用
      SMSは追加審査待ち
      30テストケースと業務受入
    計画・意思決定
      基準と完了予測を分離
      要員競合3人日
      変更会議10月16日
    データ・連携
      2万件の追跡と除外承認
      重複候補80件
      CRM認証と再送の冪等性
    品質・安全
      失敗5・ブロック4・未実施3
      権限と監査証跡
      未解決の重大不具合は公開阻止
    運用・継続性
      夜間バッチと前後照合
      時間枠超過時の停止・切戻し
      主担当と代替窓口
    定着・改善
      利用者への停止案内
      研修と問い合わせ導線
      効果確認と未完事項`,{radius:'partial'},'stable',['6領域・18の確認観点。作業順序や成果物の包含関係ではなく、抜け漏れの対話に使う論点整理です。既知の問題と将来の条件が混在するため、状態は台帳で管理します。','階層ごとに系列色を適用します。形はソースで指定し、配置は Mermaid が計算します。']),
  entry('kanban','カンバン',`kanban
  todo[未着手・着手条件待ち]
    t1[復旧演習シナリオ作成／運用]
    t2[40名向け研修案の準備／業務]
    t3[本番切替条件の草案／PM]
  doing[対応中]
    t4[CRM 401原因の共同調査／開発]
    t5[重複候補80件の規則案／業務]
    t6[夜間窓口の主副調整／運用]
  blocked[ブロック・判断待ち]
    t7[実API結合試験／401解消待ち]
    t8[SMS追加／10月16日変更会議待ち]
    t9[業務検証要員／3人日不足]
  verify[レビュー・検証待ち]
    t10[移行照合手順案／品質確認待ち]
    t11[再送ケース設計／開発レビュー待ち]
    t12[停止通知文案／業務確認待ち]
  done[先行環境で確認済み]
    t13[四ロール権限テストケース／10月11日合格]
    t14[要件合意／10月10日・2日遅延]`,{radius:'partial'},'stable',['10/12〜10/16週の架空ボード、14項目。「ブロック・判断待ち」は対応中から分けます。確認済み2項目は先行検証の限定的事実で、本番の安全上の公開承認や全30テストケースの合格を意味しません。',semantic]),
  entry('sankey','サンキー図',`sankey-beta
All cases 30,Executed 23,23
All cases 30,Not executed 7,7
Executed 23,Passed 18,18
Executed 23,Failed 5,5
Not executed 7,Blocked 4,4
Not executed 7,Not started 3,3`,{palette:'full'},'stable',['架空の10/14時点、全30テストケースを実行済み23（合格18・失敗5）と未実施7（ブロック4・未着手3）へ分解。中間・終端で同じテストケースを重複計上しないフローです。円・XYと同じ分母です。','ノードと流れに共通の系列色を適用し、ラベルを背景の縁取りで読みやすくします。流れの幅は量を表し、通常の線幅とは別の設定です。固定版の CSV 読み取りは ASCII ラベルに対応します。']),
  entry('packet','パケット図',`packet-beta
  title CRM連携要求・説明用ヘッダー（架空）
  0-3: "Version (4 bit)"
  4-7: "Message type (4 bit)"
  8-15: "Flags: retry / trace (8 bit)"
  16-31: "Header length (16 bit)"
  32-63: "Payload length (32 bit)"
  64-95: "Request ID - high (32 bit)"
  96-127: "Request ID - low (32 bit)"
  128-159: "Case reference (32 bit)"
  160-191: "Sequence number (32 bit)"
  192-223: "Sent-at timestamp (32 bit)"
  224-239: "Attempt count (16 bit)"
  240-255: "Reserved - zero (16 bit)"
  256-287: "Payload begins - variable length"`,{},'stable',['0〜255ビットをヘッダー、256ビット以降を可変長ペイロードとして描く説明用メッセージ例。要求ID・再送回数・照合順序を区別します。実CRMのAPI仕様、暗号化方式、実装済みのバイナリ形式ではありません。',semantic]),

]);

export function diagramCapabilitiesFor(type) {
  const entry = DIAGRAM_CATALOG.find(item=>item.id===type);
  if (!entry) throw new Error(`現在は利用できない図種です（${type}）。対応する図種を選び直してください。`);
  // Example-specific notes describe only that catalog source. Capability notes
  // also appear for edited or project documents, so keep them content-neutral.
  const limitations={
    sequence:['角の丸みは参加者・注釈・活性区間に適用します。メッセージ線は直線です。'],
    state:['配置方向は新版の状態図に適用します。線の経路は状態図の規則に従います。'],
    pie:['扇形と凡例を番号でも対応付けます。角の丸み・接続線・配置方向は対象外です。'],
    git:['コミット・分岐・マージの意味を保ち、ブランチへ系列色を適用します。'],
    mindmap:['形はソースで指定し、配置は Mermaid が計算します。'],
    sankey:['流れの幅は量を表します。固定版のCSV読取はASCIIラベルに対応します。'],
  };
  return {type:entry.id,label:entry.label,status:entry.status,controls:{...entry.capabilities},notes:type==='gantt'?[...entry.notes]:[semantic,...(limitations[type]||[])]};
}
