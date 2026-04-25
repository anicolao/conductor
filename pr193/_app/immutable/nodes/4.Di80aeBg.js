import{B as e,C as t,F as n,H as r,I as i,J as a,L as o,P as s,Q as c,R as l,T as u,V as d,X as f,_ as p,c as m,d as h,g as ee,h as g,j as _,k as v,m as te,q as y,r as b,s as x,v as S,w as C,x as w,y as T,z as E}from"../chunks/BPPyitxZ.js";import{c as D}from"../chunks/BYz4vD1I.js";import"../chunks/v_jBEYI6.js";import{t as O}from"../chunks/DQm3D__M.js";import{a as k,r as A}from"../chunks/6mRxH2fI.js";import{t as j}from"../chunks/Ct_7rPsC.js";var M=c({prerender:()=>!1}),N=w(`<p>Loading details...</p>`),P=w(`<p class="error svelte-vsphkj"> </p>`),F=w(`<details class="artifact-card svelte-vsphkj"><summary class="svelte-vsphkj"> </summary> <div class="markdown-content svelte-vsphkj"></div></details>`),ne=w(`<section class="artifacts"><h2 class="svelte-vsphkj">Markdown Artifacts</h2> <!></section>`),re=w(`<p class="info svelte-vsphkj">No markdown artifacts found in the linked PR.</p>`),ie=w(`<header class="svelte-vsphkj"><h1 class="svelte-vsphkj"> <span class="issue-number svelte-vsphkj"> </span></h1> <p class="repo-name svelte-vsphkj"> </p></header> <!> <section class="actions svelte-vsphkj"><h2 class="svelte-vsphkj">Actions</h2> <div class="comment-area svelte-vsphkj"><label for="comment" class="svelte-vsphkj">Comment (Required for "In Progress", Optional for "Todo")</label> <textarea id="comment" placeholder="Add your feedback here..." class="svelte-vsphkj"></textarea></div> <div class="button-group svelte-vsphkj"><button class="btn approve svelte-vsphkj"> </button> <button class="btn in-progress svelte-vsphkj">Comment & Move to In Progress</button> <button class="btn todo svelte-vsphkj">Back to TODO</button></div></section>`,1),I=w(`<div class="container svelte-vsphkj"><nav class="svelte-vsphkj"><a class="svelte-vsphkj">← Back to Approval Queue</a></nav> <!></div>`);function L(t,c){a(c,!0);let w=r(()=>O.params.owner),M=r(()=>O.params.repo),L=r(()=>O.params.issue_number),R=d(null),z=d(null),B=d(E([])),V=d(!0),H=d(null),U=d(``),W=d(!1),G=`PVT_kwDOEGPutc4BUN0D`,K=`PVTSSF_lADOEGPutc4BUN0DzhBXf98`,q=`PVTSSF_lADOEGPutc4BUN0DzhBbZaw`,J={TODO:`f75ad846`,IN_PROGRESS:`47fc9ee4`,HUMAN_REVIEW:`0fd775be`,DONE:`98236657`},ae={CONDUCTOR:`e1ea423a`,CODER:`ea5e8807`};b(async()=>{let t=A();if(!t){k();return}try{await oe(t)}catch(t){console.error(t),e(H,t.message,!0)}finally{e(V,!1)}});async function oe(t){let n=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${t}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
		query IssueDetails($owner: String!, $repo: String!, $number: Int!) {
			repository(owner: $owner, name: $repo) {
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
	`,variables:{owner:u(w),repo:u(M),number:parseInt(u(L))}})})).json();if(n.errors)throw Error(n.errors[0].message);if(e(R,n.data.repository.issue,!0),!u(R))throw Error(`Issue not found`);let r=u(R).timelineItems.nodes.filter(e=>e.source&&e.source.number).map(e=>e.source);if(e(z,r[r.length-1],!0),u(z)){let n=await fetch(`https://api.github.com/repos/${u(z).baseRepository.owner.login}/${u(z).baseRepository.name}/pulls/${u(z).number}/files`,{headers:{Authorization:`Bearer ${t}`}});if(!n.ok)throw Error(`Failed to fetch PR files`);let r=(await n.json()).filter(e=>e.filename.endsWith(`.md`));e(B,await Promise.all(r.map(async e=>{let n=await(await fetch(e.contents_url,{headers:{Authorization:`Bearer ${t}`,Accept:`application/vnd.github.v3.raw`}})).text();return{filename:e.filename,raw_url:e.raw_url,content:j.parse(n)}})),!0)}}async function Y(e,t){let n=A(),r=u(R).projectItems.nodes[0]?.id;if(!r)return;let i,a;t?(i=`
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
		`,a={projectId:G,itemId:r,fieldId:e});let o=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${n}`,"Content-Type":`application/json`},body:JSON.stringify({query:i,variables:a})})).json();if(o.errors)throw Error(o.errors[0].message)}async function X(e,t){let n=A(),r=u(R).labels.nodes.map(e=>e.name).filter(e=>!t.includes(e));for(let t of e)r.includes(t)||r.push(t);if(!(await fetch(`https://api.github.com/repos/${u(w)}/${u(M)}/issues/${u(L)}/labels`,{method:`PUT`,headers:{Authorization:`Bearer ${n}`,"Content-Type":`application/json`},body:JSON.stringify({labels:r})})).ok)throw Error(`Failed to update labels`)}async function Z(e){let t=A();if(!(await fetch(`https://api.github.com/repos/${u(w)}/${u(M)}/issues/${u(L)}/comments`,{method:`POST`,headers:{Authorization:`Bearer ${t}`,"Content-Type":`application/json`},body:JSON.stringify({body:e})})).ok)throw Error(`Failed to add comment`)}async function se(){if(confirm(`Are you sure you want to approve and merge?`)){e(W,!0);try{let e=A();if(await Z(`Approved`),u(z)&&u(z).state===`OPEN`){let t=await fetch(`https://api.github.com/repos/${u(z).baseRepository.owner.login}/${u(z).baseRepository.name}/pulls/${u(z).number}/merge`,{method:`PUT`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({merge_method:`squash`})});if(!t.ok){let e=await t.json();throw Error(`Failed to merge PR: ${e.message}`)}}await Y(K,J.DONE),await Y(q,null),await X([],u(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`)||e.startsWith(`branch:`))),alert(`Approved and merged successfully!`),window.location.href=`${D}/approval`}catch(e){alert(e.message)}finally{e(W,!1)}}}async function ce(){if(!u(U).trim()){alert(`Please enter a comment.`);return}e(W,!0);try{await Z(u(U)),await Y(K,J.IN_PROGRESS),await Y(q,ae.CONDUCTOR),await X([`persona: conductor`],u(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`)&&e!==`persona: conductor`)),alert(`Comment added and moved back to In Progress.`),window.location.href=`${D}/approval`}catch(e){alert(e.message)}finally{e(W,!1)}}async function le(){e(W,!0);try{u(U).trim()&&await Z(u(U)),await Y(K,J.TODO),await Y(q,null),await X([],u(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`))),alert(`Moved back to Todo.`),window.location.href=`${D}/approval`}catch(e){alert(e.message)}finally{e(W,!1)}}var Q=I();h(`vsphkj`,e=>{v(()=>{n.title=`Approve Issue #${u(L)??``}`})});var $=i(Q),ue=i($);f($);var de=l($,2),fe=e=>{T(e,N())},pe=e=>{var t=P(),n=i(t,!0);f(t),_(()=>S(n,u(H))),T(e,t)},me=t=>{var n=ie(),r=o(n),a=i(r),c=i(a),d=l(c),m=i(d);f(d),f(a);var h=l(a,2),v=i(h);f(h),f(r);var y=l(r,2),b=e=>{var t=ne();g(l(i(t),2),17,()=>u(B),ee,(e,t)=>{var n=F(),r=i(n),a=i(r,!0);f(r);var o=l(r,2);te(o,()=>u(t).content,!0),f(o),f(n),_(()=>S(a,u(t).filename)),T(e,n)}),f(t),T(e,t)},E=e=>{T(e,re())};p(y,e=>{u(B).length>0?e(b):e(E,-1)});var D=l(y,2),O=l(i(D),2),k=l(i(O),2);s(k),f(O);var A=l(O,2),j=i(A),N=i(j,!0);f(j);var P=l(j,2),I=l(P,2);f(A),f(D),_(e=>{S(c,`${u(R).title??``} `),S(m,`#${u(L)??``}`),S(v,`${u(w)??``}/${u(M)??``}`),k.disabled=u(W),j.disabled=u(W),S(N,u(W)?`Processing...`:`Approve & Merge`),P.disabled=e,I.disabled=u(W)},[()=>u(W)||!u(U).trim()]),x(k,()=>u(U),t=>e(U,t)),C(`click`,j,se),C(`click`,P,ce),C(`click`,I,le),T(t,n)};p(de,e=>{u(V)?e(fe):u(H)?e(pe,1):e(me,-1)}),f(Q),_(()=>m(ue,`href`,`${D??``}/approval`)),T(t,Q),y()}t([`click`]);export{L as component,M as universal};