import{B as e,D as t,E as n,F as r,G as i,H as a,K as o,N as s,Q as c,R as l,S as u,U as d,V as f,W as p,Z as m,_ as ee,b as h,c as g,et as _,f as v,g as y,h as te,k as b,nt as x,r as S,s as C,v as w,w as T,z as E}from"../chunks/CcZUdtzk.js";import{c as D}from"../chunks/Cbb1F_Q6.js";import"../chunks/v_jBEYI6.js";import{t as O}from"../chunks/24VNC2TT.js";import{a as k,r as A}from"../chunks/6mRxH2fI.js";import{t as j}from"../chunks/Ct_7rPsC.js";var M=x({prerender:()=>!1}),N=T(`<p>Loading details...</p>`),P=T(`<p class="error svelte-vsphkj"> </p>`),F=T(`<details class="artifact-card svelte-vsphkj"><summary class="svelte-vsphkj"> </summary> <div class="markdown-content svelte-vsphkj"></div></details>`),ne=T(`<section class="artifacts"><h2 class="svelte-vsphkj">Markdown Artifacts</h2> <!></section>`),re=T(`<p class="info svelte-vsphkj">No markdown artifacts found in the linked PR.</p>`),ie=T(`<header class="svelte-vsphkj"><h1 class="svelte-vsphkj"> <span class="issue-number svelte-vsphkj"> </span></h1> <p class="repo-name svelte-vsphkj"> </p></header> <!> <section class="actions svelte-vsphkj"><h2 class="svelte-vsphkj">Actions</h2> <div class="comment-area svelte-vsphkj"><label for="comment" class="svelte-vsphkj">Comment (Required for "In Progress", Optional for "Todo")</label> <textarea id="comment" placeholder="Add your feedback here..." class="svelte-vsphkj"></textarea></div> <div class="button-group svelte-vsphkj"><button class="btn approve svelte-vsphkj"> </button> <button class="btn in-progress svelte-vsphkj">Comment & Move to In Progress</button> <button class="btn todo svelte-vsphkj">Back to TODO</button></div></section>`,1),I=T(`<div class="container svelte-vsphkj"><nav class="svelte-vsphkj"><a class="svelte-vsphkj">← Back to Approval Queue</a></nav> <!></div>`);function L(n,x){c(x,!0);let T=o(()=>O.params.owner),M=o(()=>O.params.repo),L=o(()=>O.params.issue_number),R=i(null),z=i(null),B=i(d([])),V=i(!0),H=i(null),U=i(``),W=i(!1),G=`PVT_kwDOEGPutc4BUN0D`,K=`PVTSSF_lADOEGPutc4BUN0DzhBXf98`,q=`PVTSSF_lADOEGPutc4BUN0DzhBbZaw`,J={TODO:`f75ad846`,IN_PROGRESS:`47fc9ee4`,HUMAN_REVIEW:`0fd775be`,DONE:`98236657`},ae={CONDUCTOR:`e1ea423a`,CODER:`ea5e8807`};S(async()=>{let e=A();if(!e){k();return}try{await oe(e)}catch(e){console.error(e),p(H,e.message,!0)}finally{p(V,!1)}});async function oe(e){let t=b(T),n=b(M),r=b(L);if(!t||!n||!r)throw Error(`Missing route parameters`);let i=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
		query IssueDetails($owner: String!, $repo: String!, $number: Int!) {
			repository(owner: $owner, name: $repo) {
				mergeCommitAllowed
				squashMergeAllowed
				rebaseMergeAllowed
				issue(number: $number) {
					id
					title
					body
					labels(first: 20) {
						nodes { name }
					}
					projectItems(first: 10) {
						nodes {
							id
						}
					}
					timelineItems(first: 50, itemTypes: [CROSS_REFERENCED_EVENT]) {
						nodes {
							... on CrossReferencedEvent {
								source {
									... on PullRequest {
										number
										url
										state
										baseRepository {
											owner { login }
											name
										}
									}
								}
							}
						}
					}
				}
			}
		}
	`,variables:{owner:t,repo:n,number:parseInt(r,10)}})})).json();if(i.errors)throw Error(i.errors[0].message);let a=i.data.repository;if(p(R,a.issue,!0),!b(R))throw Error(`Issue not found`);let o=b(R).timelineItems.nodes.filter(e=>e.source&&e.source.number).map(e=>({...e.source,repositorySettings:{mergeCommitAllowed:a.mergeCommitAllowed,squashMergeAllowed:a.squashMergeAllowed,rebaseMergeAllowed:a.rebaseMergeAllowed}}));if(p(z,o[o.length-1],!0),b(z)){let t=await fetch(`https://api.github.com/repos/${b(z).baseRepository.owner.login}/${b(z).baseRepository.name}/pulls/${b(z).number}/files`,{headers:{Authorization:`Bearer ${e}`}});if(!t.ok)throw Error(`Failed to fetch PR files`);let n=(await t.json()).filter(e=>e.filename.endsWith(`.md`));p(B,await Promise.all(n.map(async t=>{let n=await(await fetch(t.contents_url,{headers:{Authorization:`Bearer ${e}`,Accept:`application/vnd.github.v3.raw`}})).text(),r=j.parse(n);return{filename:t.filename,raw_url:t.raw_url,content:se(r,t.raw_url)}})),!0)}}function se(e,t){let n=decodeURIComponent(t);return e.replace(/(src|href)=["']([^"']+)["']/g,(e,t,r)=>{if(/^(https?:\/\/|\/|#|mailto:|data:)/i.test(r))return e;try{return`${t}="${new URL(r,n).href}"`}catch{return e}})}async function Y(e,t){let n=A(),r=b(R).projectItems.nodes[0]?.id;if(!r)return;let i,a;t?(i=`
			mutation UpdateField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
				updateProjectV2ItemFieldValue(input: {
					projectId: $projectId,
					itemId: $itemId,
					fieldId: $fieldId,
					value: { singleSelectOptionId: $optionId }
				}) {
					projectV2Item { id }
				}
			}
		`,a={projectId:G,itemId:r,fieldId:e,optionId:t}):(i=`
			mutation ClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
				clearProjectV2ItemFieldValue(input: {
					projectId: $projectId,
					itemId: $itemId,
					fieldId: $fieldId
				}) {
					projectV2Item { id }
				}
			}
		`,a={projectId:G,itemId:r,fieldId:e});let o=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${n}`,"Content-Type":`application/json`},body:JSON.stringify({query:i,variables:a})})).json();if(o.errors)throw Error(o.errors[0].message)}async function X(e,t){let n=b(T),r=b(M),i=b(L);if(!n||!r||!i)throw Error(`Missing route parameters`);let a=A(),o=b(R).labels.nodes.map(e=>e.name).filter(e=>!t.includes(e));for(let t of e)o.includes(t)||o.push(t);if(!(await fetch(`https://api.github.com/repos/${n}/${r}/issues/${i}/labels`,{method:`PUT`,headers:{Authorization:`Bearer ${a}`,"Content-Type":`application/json`},body:JSON.stringify({labels:o})})).ok)throw Error(`Failed to update labels`)}async function Z(e){let t=b(T),n=b(M),r=b(L);if(!t||!n||!r)throw Error(`Missing route parameters`);let i=A();if(!(await fetch(`https://api.github.com/repos/${t}/${n}/issues/${r}/comments`,{method:`POST`,headers:{Authorization:`Bearer ${i}`,"Content-Type":`application/json`},body:JSON.stringify({body:e})})).ok)throw Error(`Failed to add comment`)}async function ce(){if(confirm(`Are you sure you want to approve and merge?`)){p(W,!0);try{let e=A();if(await Z(`Approved`),b(z)&&b(z).state===`OPEN`){let t=`merge`;b(z).repositorySettings.squashMergeAllowed?t=`squash`:b(z).repositorySettings.rebaseMergeAllowed?t=`rebase`:b(z).repositorySettings.mergeCommitAllowed&&(t=`merge`);let n=await fetch(`https://api.github.com/repos/${b(z).baseRepository.owner.login}/${b(z).baseRepository.name}/pulls/${b(z).number}/merge`,{method:`PUT`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({merge_method:t})});if(!n.ok){let e=await n.json();throw Error(`Failed to merge PR: ${e.message}`)}}await Y(K,J.DONE),await Y(q,null),await X([],b(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`)||e.startsWith(`branch:`))),alert(`Approved and merged successfully!`),window.location.href=`${D}/approval`}catch(e){alert(e.message)}finally{p(W,!1)}}}async function le(){if(!b(U).trim()){alert(`Please enter a comment.`);return}p(W,!0);try{await Z(b(U)),await Y(K,J.IN_PROGRESS),await Y(q,ae.CONDUCTOR),await X([`persona: conductor`],b(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`)&&e!==`persona: conductor`)),alert(`Comment added and moved back to In Progress.`),window.location.href=`${D}/approval`}catch(e){alert(e.message)}finally{p(W,!1)}}async function ue(){p(W,!0);try{b(U).trim()&&await Z(b(U)),await Y(K,J.TODO),await Y(q,null),await X([],b(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`))),alert(`Moved back to Todo.`),window.location.href=`${D}/approval`}catch(e){alert(e.message)}finally{p(W,!1)}}var Q=I();v(`vsphkj`,e=>{s(()=>{E.title=`Approve Issue #${b(L)??``}`})});var $=e(Q),de=e($);_($);var fe=a($,2),pe=e=>{u(e,N())},me=t=>{var n=P(),i=e(n,!0);_(n),r(()=>h(i,b(H))),u(t,n)},he=n=>{var i=ie(),o=f(i),s=e(o),c=e(s),d=a(c),m=e(d);_(d),_(s);var g=a(s,2),v=e(g);_(g),_(o);var x=a(o,2),S=t=>{var n=ne();y(a(e(n),2),17,()=>b(B),ee,(t,n)=>{var i=F(),o=e(i),s=e(o,!0);_(o);var c=a(o,2);te(c,()=>b(n).content,!0),_(c),_(i),r(()=>h(s,b(n).filename)),u(t,i)}),_(n),u(t,n)},E=e=>{u(e,re())};w(x,e=>{b(B).length>0?e(S):e(E,-1)});var D=a(x,2),O=a(e(D),2),k=a(e(O),2);l(k),_(O);var A=a(O,2),j=e(A),N=e(j,!0);_(j);var P=a(j,2),I=a(P,2);_(A),_(D),r(e=>{h(c,`${b(R).title??``} `),h(m,`#${b(L)??``}`),h(v,`${b(T)??``}/${b(M)??``}`),k.disabled=b(W),j.disabled=b(W),h(N,b(W)?`Processing...`:`Approve & Merge`),P.disabled=e,I.disabled=b(W)},[()=>b(W)||!b(U).trim()]),C(k,()=>b(U),e=>p(U,e)),t(`click`,j,ce),t(`click`,P,le),t(`click`,I,ue),u(n,i)};w(fe,e=>{b(V)?e(pe):b(H)?e(me,1):e(he,-1)}),_(Q),r(()=>g(de,`href`,`${D??``}/approval`)),u(n,Q),m()}n([`click`]);export{L as component,M as universal};