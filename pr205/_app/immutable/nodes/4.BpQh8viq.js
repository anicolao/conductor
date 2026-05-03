import{B as e,C as t,F as n,H as r,I as i,J as a,L as o,P as s,Q as c,R as l,T as u,V as d,X as f,_ as p,b as ee,c as m,d as h,g,h as _,j as v,k as y,m as te,q as b,r as x,s as ne,v as S,w as C,x as w,y as T,z as E}from"../chunks/BPPyitxZ.js";import{c as D}from"../chunks/CER6GY6P.js";import"../chunks/v_jBEYI6.js";import{t as O}from"../chunks/BFnHFUn-.js";import{a as k,r as A}from"../chunks/6mRxH2fI.js";import{t as j}from"../chunks/Ct_7rPsC.js";var M=c({prerender:()=>!1}),N=w(`<p>Loading details...</p>`),P=w(`<p class="error svelte-vsphkj"> </p>`),re=w(`<div class="warning svelte-vsphkj"><p class="svelte-vsphkj"><strong>Multiple pull requests are linked to this issue.</strong></p> <p class="svelte-vsphkj">Please approve and merge them manually on GitHub. The "Approve & Merge" button is disabled to avoid ambiguity.</p></div>`),ie=w(`<details class="artifact-card svelte-vsphkj"><summary class="svelte-vsphkj"> </summary> <div class="markdown-content svelte-vsphkj"></div></details>`),ae=w(`<p class="info svelte-vsphkj"> </p>`),oe=w(`<section class="artifacts"><h2 class="svelte-vsphkj"> </h2> <p class="pr-link svelte-vsphkj"><a target="_blank" rel="noopener noreferrer" class="svelte-vsphkj"> </a></p> <!></section>`),se=w(`<p class="info svelte-vsphkj">No linked pull requests found.</p>`),F=w(`<button class="btn approve svelte-vsphkj"> </button>`),ce=w(`<header class="svelte-vsphkj"><h1 class="svelte-vsphkj"> <span class="issue-number svelte-vsphkj"> </span></h1> <p class="repo-name svelte-vsphkj"> </p></header> <!> <!> <!> <section class="actions svelte-vsphkj"><h2 class="svelte-vsphkj">Actions</h2> <div class="comment-area svelte-vsphkj"><label for="comment" class="svelte-vsphkj">Comment (Required for "In Progress", Optional for "Todo")</label> <textarea id="comment" placeholder="Add your feedback here..." class="svelte-vsphkj"></textarea></div> <div class="button-group svelte-vsphkj"><!> <button class="btn in-progress svelte-vsphkj">Comment & Move to In Progress</button> <button class="btn todo svelte-vsphkj">Back to TODO</button></div></section>`,1),I=w(`<div class="container svelte-vsphkj"><nav class="svelte-vsphkj"><a class="svelte-vsphkj">← Back to Approval Queue</a></nav> <!></div>`);function L(t,c){a(c,!0);let w=r(()=>O.params.owner),M=r(()=>O.params.repo),L=r(()=>O.params.issue_number),R=d(null),z=d(E([])),B=d(!0),V=d(null),H=d(``),U=d(!1),W=`PVT_kwDOEGPutc4BUN0D`,G=`PVTSSF_lADOEGPutc4BUN0DzhBXf98`,K=`PVTSSF_lADOEGPutc4BUN0DzhBbZaw`,q={TODO:`f75ad846`,IN_PROGRESS:`47fc9ee4`,HUMAN_REVIEW:`0fd775be`,DONE:`98236657`},le={CONDUCTOR:`e1ea423a`,CODER:`ea5e8807`};x(async()=>{let t=A();if(!t){k();return}try{await ue(t)}catch(t){console.error(t),e(V,t instanceof Error?t.message:String(t),!0)}finally{e(B,!1)}});async function ue(t){let n=u(w),r=u(M),i=u(L);if(!n||!r||!i)throw Error(`Missing route parameters`);let a=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${t}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
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
	`,variables:{owner:n,repo:r,number:parseInt(i,10)}})})).json();if(a.errors)throw Error(a.errors[0].message);let o=a.data.repository;if(e(R,o.issue,!0),!u(R))throw Error(`Issue not found`);let s=u(R).timelineItems.nodes.filter(e=>e.source?.number).map(e=>({...e.source,repositorySettings:{mergeCommitAllowed:o.mergeCommitAllowed,squashMergeAllowed:o.squashMergeAllowed,rebaseMergeAllowed:o.rebaseMergeAllowed}})),c=new Map;for(let e of s)c.set(e.number,e);e(z,await Promise.all(Array.from(c.values()).map(async e=>{let n=await fetch(`https://api.github.com/repos/${e.baseRepository.owner.login}/${e.baseRepository.name}/pulls/${e.number}/files`,{headers:{Authorization:`Bearer ${t}`}});if(!n.ok)throw Error(`Failed to fetch PR files for #${e.number}`);let r=(await n.json()).filter(e=>e.filename.endsWith(`.md`)),i=await Promise.all(r.map(async e=>{let n=await(await fetch(e.contents_url,{headers:{Authorization:`Bearer ${t}`,Accept:`application/vnd.github.v3.raw`}})).text(),r=j.parse(n);return{filename:e.filename,raw_url:e.raw_url,content:de(r,e.raw_url)}}));return{...e,markdownFiles:i}})),!0)}function de(e,t){let n=decodeURIComponent(t);return e.replace(/(src|href)=["']([^"']+)["']/g,(e,t,r)=>{if(/^(https?:\/\/|\/|#|mailto:|data:)/i.test(r))return e;try{return`${t}="${new URL(r,n).href}"`}catch{return e}})}async function J(e,t){let n=A(),r=u(R)?.projectItems.nodes[0]?.id;if(!r)return;let i,a;t?(i=`
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
		`,a={projectId:W,itemId:r,fieldId:e,optionId:t}):(i=`
			mutation ClearField($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
				clearProjectV2ItemFieldValue(input: {
					projectId: $projectId,
					itemId: $itemId,
					fieldId: $fieldId
				}) {
					projectV2Item { id }
				}
			}
		`,a={projectId:W,itemId:r,fieldId:e});let o=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${n}`,"Content-Type":`application/json`},body:JSON.stringify({query:i,variables:a})})).json();if(o.errors)throw Error(o.errors[0].message)}async function Y(e,t){let n=u(w),r=u(M),i=u(L);if(!n||!r||!i)throw Error(`Missing route parameters`);if(!u(R))throw Error(`Issue data not found`);let a=A(),o=u(R).labels.nodes.map(e=>e.name).filter(e=>!t.includes(e));for(let t of e)o.includes(t)||o.push(t);if(!(await fetch(`https://api.github.com/repos/${n}/${r}/issues/${i}/labels`,{method:`PUT`,headers:{Authorization:`Bearer ${a}`,"Content-Type":`application/json`},body:JSON.stringify({labels:o})})).ok)throw Error(`Failed to update labels`)}async function X(e){let t=u(w),n=u(M),r=u(L);if(!t||!n||!r)throw Error(`Missing route parameters`);let i=A();if(!(await fetch(`https://api.github.com/repos/${t}/${n}/issues/${r}/comments`,{method:`POST`,headers:{Authorization:`Bearer ${i}`,"Content-Type":`application/json`},body:JSON.stringify({body:e})})).ok)throw Error(`Failed to add comment`)}async function fe(){if(confirm(`Are you sure you want to approve and merge?`)&&u(R)){e(U,!0);try{let e=A();await X(`Approved`);let t=u(z).length===1?u(z)[0]:null;if(t&&t.state===`OPEN`){let n=`merge`;t.repositorySettings.squashMergeAllowed?n=`squash`:t.repositorySettings.rebaseMergeAllowed?n=`rebase`:t.repositorySettings.mergeCommitAllowed&&(n=`merge`);let r=await fetch(`https://api.github.com/repos/${t.baseRepository.owner.login}/${t.baseRepository.name}/pulls/${t.number}/merge`,{method:`PUT`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({merge_method:n})});if(!r.ok){let e=await r.json();throw Error(`Failed to merge PR: ${e.message}`)}}await J(G,q.DONE),await J(K,null),await Y([],u(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`)||e.startsWith(`branch:`))),alert(`Approved and merged successfully!`),window.location.href=`${D}/approval`}catch(e){let t=e instanceof Error?e.message:String(e);alert(t)}finally{e(U,!1)}}}async function pe(){if(!u(H).trim()){alert(`Please enter a comment.`);return}if(u(R)){e(U,!0);try{await X(u(H)),await J(G,q.IN_PROGRESS),await J(K,le.CONDUCTOR),await Y([`persona: conductor`],u(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`)&&e!==`persona: conductor`)),alert(`Comment added and moved back to In Progress.`),window.location.href=`${D}/approval`}catch(e){let t=e instanceof Error?e.message:String(e);alert(t)}finally{e(U,!1)}}}async function me(){if(u(R)){e(U,!0);try{u(H).trim()&&await X(u(H)),await J(G,q.TODO),await J(K,null),await Y([],u(R).labels.nodes.map(e=>e.name).filter(e=>e.startsWith(`persona:`))),alert(`Moved back to Todo.`),window.location.href=`${D}/approval`}catch(e){let t=e instanceof Error?e.message:String(e);alert(t)}finally{e(U,!1)}}}var Z=I();h(`vsphkj`,e=>{y(()=>{n.title=`Approve Issue #${u(L)??``}`})});var Q=i(Z),he=i(Q);f(Q);var ge=l(Q,2),$=e=>{T(e,N())},_e=e=>{var t=P(),n=i(t,!0);f(t),v(()=>S(n,u(V))),T(e,t)},ve=t=>{var n=ce(),r=o(n),a=i(r),c=i(a),d=l(c),h=i(d);f(d),f(a);var y=l(a,2),b=i(y);f(y),f(r);var x=l(r,2),E=e=>{T(e,re())};p(x,e=>{u(z).length>1&&e(E)});var D=l(x,2);_(D,17,()=>u(z),g,(e,t)=>{var n=oe(),r=i(n),a=i(r);f(r);var s=l(r,2),c=i(s),d=i(c);f(c),f(s);var h=l(s,2),y=e=>{var n=ee();_(o(n),17,()=>u(t).markdownFiles,g,(e,t)=>{var n=ie(),r=i(n),a=i(r,!0);f(r);var o=l(r,2);te(o,()=>u(t).content,!0),f(o),f(n),v(()=>S(a,u(t).filename)),T(e,n)}),T(e,n)},b=e=>{var n=ae(),r=i(n);f(n),v(()=>S(r,`No markdown artifacts found in PR #${u(t).number??``}.`)),T(e,n)};p(h,e=>{u(t).markdownFiles.length>0?e(y):e(b,-1)}),f(n),v(()=>{S(a,`PR #${u(t).number??``} Artifacts`),m(c,`href`,u(t).url),S(d,`View PR #${u(t).number??``} on GitHub`)}),T(e,n)});var O=l(D,2),k=e=>{T(e,se())};p(O,e=>{u(z).length===0&&e(k)});var A=l(O,2),j=l(i(A),2),N=l(i(j),2);s(N),f(j);var P=l(j,2),I=i(P),B=e=>{var t=F(),n=i(t,!0);f(t),v(()=>{t.disabled=u(U),S(n,u(U)?`Processing...`:`Approve & Merge`)}),C(`click`,t,fe),T(e,t)};p(I,e=>{u(z).length<=1&&e(B)});var V=l(I,2),W=l(V,2);f(P),f(A),v(e=>{S(c,`${u(R).title??``} `),S(h,`#${u(L)??``}`),S(b,`${u(w)??``}/${u(M)??``}`),N.disabled=u(U),V.disabled=e,W.disabled=u(U)},[()=>u(U)||!u(H).trim()]),ne(N,()=>u(H),t=>e(H,t)),C(`click`,V,pe),C(`click`,W,me),T(t,n)};p(ge,e=>{u(B)?e($):u(V)?e(_e,1):u(R)&&e(ve,2)}),f(Z),v(()=>m(he,`href`,`${D??``}/approval`)),T(t,Z),b()}t([`click`]);export{L as component,M as universal};