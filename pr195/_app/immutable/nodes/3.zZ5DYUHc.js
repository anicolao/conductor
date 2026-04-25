import{B as e,F as t,G as n,H as r,P as i,Q as a,S as o,U as s,W as c,Z as l,_ as u,b as d,c as f,et as p,f as m,g as h,k as g,r as _,v,w as y,z as b}from"../chunks/CcZUdtzk.js";import{c as x}from"../chunks/Cbb1F_Q6.js";import"../chunks/v_jBEYI6.js";import{a as S,r as C}from"../chunks/6mRxH2fI.js";var w=y(`<p>Loading approval queue...</p>`),T=y(`<p class="error svelte-sv3efk"> </p>`),E=y(`<p>No items currently in Human Review.</p>`),D=y(`<tr><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"> </td><td class="svelte-sv3efk"><a class="view-link svelte-sv3efk">View & Approve</a></td></tr>`),O=y(`<table class="svelte-sv3efk"><thead><tr><th class="svelte-sv3efk">Issue</th><th class="svelte-sv3efk">Repository</th><th class="svelte-sv3efk">Title</th><th class="svelte-sv3efk">Action</th></tr></thead><tbody></tbody></table>`),k=y(`<div class="container svelte-sv3efk"><nav class="svelte-sv3efk"><a class="svelte-sv3efk">← Back to Dashboard</a></nav> <h1 class="svelte-sv3efk">Approval Queue</h1> <!></div>`);function A(y,A){a(A,!0);let j=n(s([])),M=n(!0),N=n(null);_(async()=>{let e=C();if(!e){S();return}try{let t=await(await fetch(`https://api.github.com/graphql`,{method:`POST`,headers:{Authorization:`Bearer ${e}`,"Content-Type":`application/json`},body:JSON.stringify({query:`
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
		`,variables:{org:`LLM-Orchestration`,number:1}})})).json();if(t.errors)throw Error(t.errors[0].message);let n=t.data.organization.projectV2.items.nodes;c(j,n.filter(e=>e.status?.optionId===`0fd775be`&&e.content?.number),!0)}catch(e){console.error(e),c(N,e.message,!0)}finally{c(M,!1)}});var P=k();m(`sv3efk`,e=>{i(()=>{b.title=`Approval Queue - Conductor`})});var F=e(P),I=e(F);p(F);var L=r(F,4),R=e=>{o(e,w())},z=n=>{var r=T(),i=e(r,!0);p(r),t(()=>d(i,g(N))),o(n,r)},B=e=>{o(e,E())},V=n=>{var i=O(),a=r(e(i));h(a,21,()=>g(j),u,(n,i)=>{var a=D(),s=e(a),c=e(s);p(s);var l=r(s),u=e(l,!0);p(l);var m=r(l),h=e(m,!0);p(m);var _=r(m),v=e(_);p(_),p(a),t(()=>{d(c,`#${g(i).content.number??``}`),d(u,g(i).content.repository.nameWithOwner),d(h,g(i).content.title),f(v,`href`,`${x??``}/approval/${g(i).content.repository.owner.login??``}/${g(i).content.repository.name??``}/${g(i).content.number??``}`)}),o(n,a)}),p(a),p(i),o(n,i)};v(L,e=>{g(M)?e(R):g(N)?e(z,1):g(j).length===0?e(B,2):e(V,-1)}),p(P),t(()=>f(I,`href`,`${x??``}/`)),o(y,P),l()}export{A as component};