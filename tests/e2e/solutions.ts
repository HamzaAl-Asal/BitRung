// Known solutions for "Pair with a Target Sum". Each wrong one is a mistake people
// actually make; the hidden tests must catch every one of them.

export const CORRECT_CPP = `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n; long long t; cin >> n >> t;
    unordered_map<long long, int> seen; seen.reserve(n * 2);
    for (int i = 0; i < n; i++) {
        long long x; cin >> x;
        auto it = seen.find(t - x);
        if (it != seen.end()) { cout << it->second << " " << i << "\\n"; return 0; }
        seen.emplace(x, i);
    }
}`;

export const CORRECT_PY = `import sys
data = sys.stdin.buffer.read().split()
n, t = int(data[0]), int(data[1])
seen = {}
for i in range(n):
    x = int(data[2 + i])
    j = seen.get(t - x)
    if j is not None:
        print(j, i)
        break
    seen.setdefault(x, i)`;

export type Case = { name: string; lang: "C++17" | "Python 3"; expect: string; source: string; passesSamples?: boolean };

export const WRONG: Case[] = [
  {
    name: "pairs an element with itself",
    lang: "C++17",
    expect: "WrongAnswer",
    source: `#include <bits/stdc++.h>
using namespace std;
int main(){int n; long long t; cin>>n>>t; unordered_map<long long,int> s;
for(int i=0;i<n;i++){long long x;cin>>x; s[x]=i; auto it=s.find(t-x);
if(it!=s.end()){cout<<min(it->second,i)<<" "<<max(it->second,i)<<"\\n";return 0;}}}`,
  },
  {
    name: "prints the positions in the wrong order",
    lang: "C++17",
    expect: "WrongAnswer",
    source: `#include <bits/stdc++.h>
using namespace std;
int main(){int n; long long t; cin>>n>>t; unordered_map<long long,int> s;
for(int i=0;i<n;i++){long long x;cin>>x; auto it=s.find(t-x);
if(it!=s.end()){cout<<i<<" "<<it->second<<"\\n";return 0;} s.emplace(x,i);}}`,
  },
  {
    name: "prints 1-indexed positions",
    lang: "Python 3",
    expect: "WrongAnswer",
    source: `import sys
d = sys.stdin.buffer.read().split(); n, t = int(d[0]), int(d[1]); seen = {}
for i in range(n):
    x = int(d[2 + i])
    if t - x in seen:
        print(seen[t - x] + 1, i + 1); break
    seen.setdefault(x, i)`,
  },
  {
    name: "only checks neighbours",
    lang: "Python 3",
    expect: "WrongAnswer",
    passesSamples: true,
    source: `import sys
d = sys.stdin.buffer.read().split(); n, t = int(d[0]), int(d[1]); a = list(map(int, d[2:2 + n]))
for i in range(n - 1):
    if a[i] + a[i + 1] == t:
        print(i, i + 1); break
else:
    print(0, 1)`,
  },
  {
    name: "answers with sorted positions",
    lang: "C++17",
    expect: "WrongAnswer",
    source: `#include <bits/stdc++.h>
using namespace std;
int main(){int n; long long t; cin>>n>>t; vector<long long>a(n); for(auto&x:a)cin>>x; sort(a.begin(),a.end());
int i=0,j=n-1; while(i<j){long long s=a[i]+a[j]; if(s==t)break; if(s<t)i++; else j--;} cout<<i<<" "<<j<<"\\n";}`,
  },
  {
    name: "skips negative numbers",
    lang: "C++17",
    expect: "WrongAnswer",
    source: `#include <bits/stdc++.h>
using namespace std;
int main(){int n; long long t; cin>>n>>t; unordered_map<long long,int> s;
for(int i=0;i<n;i++){long long x;cin>>x; if(x<0) continue; auto it=s.find(t-x);
if(it!=s.end()){cout<<it->second<<" "<<i<<"\\n";return 0;} s.emplace(x,i);} cout<<"0 1\\n";}`,
  },
  {
    name: "O(n^2) scan in C++",
    lang: "C++17",
    expect: "TimeLimitExceeded",
    source: `#include <bits/stdc++.h>
using namespace std;
int main(){int n; long long t; cin>>n>>t; vector<long long>a(n); for(auto&x:a)cin>>x;
for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(a[i]+a[j]==t){cout<<i<<" "<<j<<"\\n";return 0;}}`,
  },
  {
    name: "O(n^2) scan in Python",
    lang: "Python 3",
    expect: "TimeLimitExceeded",
    source: `n, t = map(int, input().split())
a = list(map(int, input().split()))
for i in range(n):
    for j in range(i + 1, n):
        if a[i] + a[j] == t:
            print(i, j)
            raise SystemExit`,
  },
  { name: "does not compile", lang: "C++17", expect: "CompilationError", source: `int main() { this is not c++ }` },
  {
    name: "dereferences a null pointer",
    lang: "C++17",
    expect: "RuntimeError",
    source: `#include <cstdio>
int main(){ volatile int *p = nullptr; *p = 1; std::puts("0 1"); }`,
  },
];
