import { describe, expect, it } from "vitest";
import {
  codeFingerprints,
  codeTokens,
  findSimilarPairs,
  introShingles,
  introWords,
  overlapPercent,
  MAX_PAIRS,
  MIN_CODE_TOKENS,
  SIMILAR_PERCENT,
} from "@/lib/integrity/similarity";
import { taskSimilarPairs } from "@/lib/integrity/taskSimilarity";

const twoSum = `
def count_pairs(nums, target):
    # count pairs that add up to the target
    total = 0
    seen = {}
    for value in nums:
        need = target - value
        if need in seen:
            total += seen[need]
        seen[value] = seen.get(value, 0) + 1
    return total

n, target = map(int, input().split())
nums = list(map(int, input().split()))
print(count_pairs(nums, target))
`;

// Same program: names changed, comments changed, spacing changed, a docstring added.
const twoSumRenamed = `
def f(a, t):
    """Docstring added to hide the copy."""
    c = 0
    m = {}
    for x in a:   # loop
        y = t - x
        if y in m:
            c += m[y]
        m[x] = m.get(x, 0) + 1
    return c

k, t = map(int, input().split())
a = list(map(int, input().split()))
print(f(a, t))
`;

// A different correct approach (sort + two pointers).
const twoPointers = `
n, target = map(int, input().split())
nums = sorted(map(int, input().split()))
left, right = 0, len(nums) - 1
answer = 0
while left < right:
    s = nums[left] + nums[right]
    if s == target:
        answer += 1
        left += 1
        right -= 1
    elif s < target:
        left += 1
    else:
        right -= 1
print(answer)
`;

const cppSum = `
#include <bits/stdc++.h>
using namespace std;
// read the array and count pairs
int main() {
    int n, target; cin >> n >> target;
    vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];
    map<int, int> seen; long long total = 0;
    for (int i = 0; i < n; i++) { /* look back */ total += seen[target - a[i]]; seen[a[i]]++; }
    cout << total << endl;
    return 0;
}
`;

const intro =
  "Good morning, my name is Asha Sharma and I am a final year computer science student at Acropolis Institute. I enjoy building web applications and I recently made a canteen ordering app with React and Firebase that our hostel now uses every day. I am comfortable with Java, Python and SQL, and I solved more than three hundred problems on LeetCode. My goal is to join a product company as a software engineer where I can learn from strong teams.";
const introCopy = intro.replace("Asha Sharma", "Rohan Verma").replace("canteen ordering", "library booking");
const introOwn =
  "Hello, I am Kabir from the IT branch. I love data and spent last summer cleaning sales data for a local shop, which taught me pandas and patience. In college I lead the coding club, where we run weekly contests for juniors. I want to start my career as a data analyst, grow into machine learning, and keep teaching others what I learn along the way. Outside class I play chess and write short blog posts about the projects I build.";

describe("codeTokens", () => {
  it("drops comments and replaces names, strings and numbers", () => {
    expect(codeTokens('x = 10  # set\nprint("hi", x)', "python")).toEqual(["v", "=", "n", "print", "(", "s", ",", "v", ")"]);
    expect(codeTokens('int a = 5; // c\n/* block */ cout << "x";', "cpp")).toEqual(["int", "v", "=", "n", ";", "cout", "<", "<", "s", ";"]);
  });

  it("gives renamed, recommented code with a docstring almost the same tokens", () => {
    const a = codeTokens(twoSum, "python");
    const b = codeTokens(twoSumRenamed, "python").filter((_, i, all) => !(all[i] === "s" && all[i - 1] === ":")); // the docstring
    expect(b).toEqual(a);
  });
});

describe("fingerprints and overlap", () => {
  it("is high for the same program renamed, low for a different approach", () => {
    const a = codeFingerprints(codeTokens(twoSum, "python"));
    expect(overlapPercent(a, codeFingerprints(codeTokens(twoSumRenamed, "python")))).toBeGreaterThanOrEqual(SIMILAR_PERCENT);
    expect(overlapPercent(a, codeFingerprints(codeTokens(twoPointers, "python")))).toBeLessThan(SIMILAR_PERCENT);
  });

  it("is 0 when either side is empty, and divides by the smaller set", () => {
    expect(overlapPercent(new Set(), new Set([1]))).toBe(0);
    expect(overlapPercent(new Set([1, 2, 3, 4]), new Set([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(100); // a copy with text added
    expect(overlapPercent(new Set([1, 2, 3, 4]), new Set([1, 2, 5, 6]))).toBe(50);
  });

  it("matches a copied intro with a few words changed, not a different one", () => {
    const base = introShingles(introWords(intro));
    expect(overlapPercent(base, introShingles(introWords(introCopy)))).toBeGreaterThanOrEqual(SIMILAR_PERCENT);
    expect(overlapPercent(base, introShingles(introWords(introOwn)))).toBeLessThan(10);
  });
});

describe("findSimilarPairs", () => {
  it("reports copied code, not different solutions", () => {
    const pairs = findSimilarPairs("coding", [
      { submissionId: "a", uid: "s1", content: twoSum, language: "python" },
      { submissionId: "b", uid: "s2", content: twoSumRenamed, language: "python" },
      { submissionId: "c", uid: "s3", content: twoPointers, language: "python" },
    ]);
    expect(pairs.map((p) => [p.uidA, p.uidB, p.submissionIdA, p.submissionIdB])).toEqual([["s1", "s2", "a", "b"]]);
  });

  it("compares code only within one language", () => {
    expect(
      findSimilarPairs("coding", [
        { submissionId: "a", uid: "s1", content: cppSum, language: "cpp" },
        { submissionId: "b", uid: "s2", content: cppSum, language: "java" },
      ]),
    ).toEqual([]);
  });

  it(`skips code under ${MIN_CODE_TOKENS} tokens, where every correct answer looks alike`, () => {
    const short = "a, b = map(int, input().split())\nprint(a + b)\n";
    expect(codeTokens(short, "python").length).toBeLessThan(MIN_CODE_TOKENS);
    expect(
      findSimilarPairs("coding", [
        { submissionId: "a", uid: "s1", content: short, language: "python" },
        { submissionId: "b", uid: "s2", content: short, language: "python" },
      ]),
    ).toEqual([]);
  });

  it("reports copied intros, highest first", () => {
    const pairs = findSimilarPairs("intro_written", [
      { submissionId: "a", uid: "s1", content: intro },
      { submissionId: "b", uid: "s2", content: introCopy },
      { submissionId: "c", uid: "s3", content: introOwn },
      { submissionId: "d", uid: "s4", content: intro },
    ]);
    expect(pairs[0]).toMatchObject({ uidA: "s1", uidB: "s4", percent: 100 });
    expect(pairs.map((p) => `${p.uidA}-${p.uidB}`).sort()).toEqual(["s1-s2", "s1-s4", "s2-s4"]);
  });

  it(`stores at most ${MAX_PAIRS} pairs`, () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({ submissionId: `x${i}`, uid: `s${i}`, content: intro }));
    expect(findSimilarPairs("intro_written", entries)).toHaveLength(MAX_PAIRS); // 66 pairs → 50
  });
});

describe("taskSimilarPairs", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 5, h));
  const attempt = (id: string, uid: string, content: string, h: number, status: "done" | "error" = "done", taskId = "t1") => ({
    id,
    taskId,
    uid,
    status,
    createdAt: at(h),
    content,
    language: "python" as const,
  });

  it("uses each student's latest finished attempt on this task only", () => {
    const pairs = taskSimilarPairs({ id: "t1", type: "coding" }, new Set(["s1", "s2"]), [
      attempt("a1", "s1", twoSum, 1),
      attempt("b1", "s2", twoSumRenamed, 1),
      attempt("b2", "s2", twoPointers, 2), // s2 rewrote it later: no longer alike
      attempt("b3", "s2", twoSumRenamed, 3, "error"), // failed: ignored
      attempt("c1", "s2", twoSum, 4, "done", "t2"), // another task: ignored
    ]);
    expect(pairs).toEqual([]);
  });

  it("finds the pair when the latest attempts match, and skips students not counted", () => {
    const pairs = taskSimilarPairs({ id: "t1", type: "coding" }, new Set(["s1", "s2"]), [
      attempt("a1", "s1", twoSum, 1),
      attempt("b1", "s2", twoSum.replaceAll("nums", "arr"), 2),
      attempt("z1", "removed", twoSum, 2),
    ]);
    expect(pairs).toEqual([{ uidA: "s1", uidB: "s2", submissionIdA: "a1", submissionIdB: "b1", percent: 100 }]);
  });

  it("never compares a resume task", () => {
    expect(taskSimilarPairs({ id: "t1", type: "resume" }, new Set(["s1"]), [])).toBeUndefined();
  });
});
