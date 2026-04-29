import{A as e,B as t,F as n,I as r,J as i,L as a,R as o,T as s,V as c,X as l,Z as u,_ as d,c as f,d as p,g as m,h,j as g,q as _,r as v,v as y,x as b,y as x,z as S}from"../chunks/_Nv6bVSQ.js";import{c as C}from"../chunks/CFJYd1i7.js";import"../chunks/v_jBEYI6.js";import{a as w,r as T}from"../chunks/6mRxH2fI.js";var E=b(`<p>Loading approval queue...</p>`),D=b(`<p class="error svelte-sv3efk"> </p>`),O=b(`<p>No items currently in Human Review.</p>`),k=b(`<tr><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"><a class="view-link svelte-sv3efk">View & Approve</a></td></tr>`),A=b(`<a class="mobile-item-link svelte-sv3efk"><div class="list-item svelte-sv3efk"><div class="item-meta svelte-sv3efk"><div class="meta-left svelte-sv3efk"><span class="repo-tag svelte-sv3efk"> </span> <span class="issue-tag svelte-sv3efk"> </span></div> <span class="action-hint svelte-sv3efk">View & Approve →</span></div> <h2 class="item-title svelte-sv3efk"> </h2></div></a>`),j=b(`<div class="desktop-view svelte-sv3efk"><table class="svelte-sv3efk"><thead><tr><th class="svelte-sv3efk">Issue</th><th class="svelte-sv3efk">Repository</th><th class="svelte-sv3efk">Title</th><th class="svelte-sv3efk">Action</th></tr></thead><tbody></tbody></table></div> <div class="mobile-view svelte-sv3efk"></div>`,1),M=b(`<div class="container svelte-sv3efk"><nav class="svelte-sv3efk"><a class="svelte-sv3efk">← Back to Dashboard</a></nav> <h1 class="svelte-sv3efk">Approval Queue</h1> <!></div>`);function N(b,N){i(N,!0);let P=c(S([])),F=c(!0),I=c(null);v(async()=>{let e=T();if(!e){w();return}try{let n=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
			query ProjectItems($org: String!, $number: Int!) {
				organization(login: $org) {
					projectV2(number: $number) {
						items(first: 100) {
							nodes {
								id
								status: fieldValueByName(name: "Status") {
									... on ProjectV2ItemFieldSingleSelectValue {
										name
										optionId
									}
								}
								content {
									... on Issue {
										number
										title
										repository {
											nameWithOwner
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
		`,variables:{org:`LLM-Orchestration`,number:1}})})).json();if(n.errors)throw Error(n.errors[0].message);let r=n.data.organization.projectV2.items.nodes;t(P,r.filter(e=>e.status?.optionId===`0fd775be`&&e.content?.number),!0)}catch(e){console.error(e),t(I,e instanceof Error?e.message:String(e),!0)}finally{t(F,!1)}});var L=M();p(`sv3efk`,t=>{e(()=>{n.title=`Approval Queue - Conductor`})});var R=r(L),z=r(R);u(R);var B=o(R,4),V=e=>{x(e,E())},H=e=>{var t=D(),n=r(t,!0);u(t),g(()=>y(n,s(I))),x(e,t)},U=e=>{x(e,O())},W=e=>{var t=j(),n=a(t),i=r(n),c=o(r(i));h(c,21,()=>s(P),m,(e,t)=>{var n=k(),i=r(n),a=r(i);u(i);var c=o(i),l=r(c,!0);u(c);var d=o(c),p=r(d,!0);u(d);var m=o(d),h=r(m);u(m),u(n),g(()=>{y(a,`#${s(t).content.number??``}`),y(l,s(t).content.repository.nameWithOwner),y(p,s(t).content.title),f(h,`href`,`${C??``}/approval/${s(t).content.repository.owner.login??``}/${s(t).content.repository.name??``}/${s(t).content.number??``}`)}),x(e,n)}),u(c),u(i),u(n);var d=o(n,2);h(d,21,()=>s(P),m,(e,t)=>{var n=A(),i=r(n),a=r(i),c=r(a),d=r(c),p=r(d,!0);u(d);var m=o(d,2),h=r(m);u(m),u(c),l(2),u(a);var _=o(a,2),v=r(_,!0);u(_),u(i),u(n),g(()=>{f(n,`href`,`${C??``}/approval/${s(t).content.repository.owner.login??``}/${s(t).content.repository.name??``}/${s(t).content.number??``}`),y(p,s(t).content.repository.nameWithOwner),y(h,`#${s(t).content.number??``}`),y(v,s(t).content.title)}),x(e,n)}),u(d),x(e,t)};d(B,e=>{s(F)?e(V):s(I)?e(H,1):s(P).length===0?e(U,2):e(W,-1)}),u(L),g(()=>f(z,`href`,`${C??``}/`)),x(b,L),_()}export{N as component};