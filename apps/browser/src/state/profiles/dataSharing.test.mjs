import assert from "node:assert/strict";
import { test } from "node:test";
import { loginGroups, profileLoginGroup, renameLoginGroup, shareProfileLogins, unshareProfileLogins } from "./dataSharing.ts";

const profile = (id, over = {}) => ({ id, name: id, color: "blue", icon: null, createdAt: 0, ...over });

function handle(profiles, order) {
  const calls = [];
  return {
    handle: {
      profiles,
      profileOrder: order,
      setProfileData: (id, patch) => {
        calls.push([id, patch]);
        const p = profiles[id];
        if (!p) return;
        if (patch.dataId !== undefined) {
          if (patch.dataId === null) p.dataId = `d-${id}`;
          else if (patch.dataId === p.id) delete p.dataId;
          else p.dataId = patch.dataId;
        }
        if (patch.dataName !== undefined) {
          if (patch.dataName === null) delete p.dataName;
          else p.dataName = patch.dataName;
        }
      },
    },
    calls,
  };
}

test("profiles group by data store, named by the group's name or its first profile", () => {
  const profiles = {
    a: profile("a", { name: "Personal" }),
    b: profile("b", { name: "Work", dataId: "shared" }),
    c: profile("c", { name: "Side", dataId: "shared", dataName: "Team" }),
  };
  const groups = loginGroups(profiles, ["a", "b", "c"]);
  assert.deepEqual(groups, [
    { dataId: "a", name: "Personal", profileIds: ["a"] },
    { dataId: "shared", name: "Team", profileIds: ["b", "c"] },
  ]);
  assert.equal(profileLoginGroup(profiles, ["a", "b", "c"], "c")?.dataId, "shared");
  assert.equal(profileLoginGroup(profiles, ["a", "b", "c"], "missing"), null);
});

test("sharing logins moves a profile into the other profile's store", () => {
  const profiles = { a: profile("a"), b: profile("b") };
  const { handle: h, calls } = handle(profiles, ["a", "b"]);
  assert.equal(shareProfileLogins(h, "a", "b"), true);
  assert.deepEqual(calls, [["a", { dataId: "b", dataName: null }]]);
  assert.equal(shareProfileLogins(h, "a", "b"), false);
  assert.equal(shareProfileLogins(h, "a", "a"), false);
  assert.equal(shareProfileLogins(h, "a", "missing"), false);
});

test("unsharing gives a profile its own store again, only when it shares one", () => {
  const profiles = { a: profile("a", { dataId: "shared" }), b: profile("b", { dataId: "shared" }) };
  const { handle: h, calls } = handle(profiles, ["a", "b"]);
  assert.equal(unshareProfileLogins(h, "a"), true);
  assert.equal(calls[0][0], "a");
  assert.equal(calls[0][1].dataId, null);
  assert.equal(unshareProfileLogins(h, "a"), false);
});

test("renaming a login group names every profile in it", () => {
  const profiles = { a: profile("a", { dataId: "shared" }), b: profile("b", { dataId: "shared" }) };
  const { handle: h, calls } = handle(profiles, ["a", "b"]);
  assert.equal(renameLoginGroup(h, "shared", "  Team  "), true);
  assert.deepEqual(calls, [
    ["a", { dataName: "Team" }],
    ["b", { dataName: "Team" }],
  ]);
  assert.equal(loginGroups(profiles, ["a", "b"])[0].name, "Team");
  assert.equal(renameLoginGroup(h, "missing", "X"), false);
  assert.equal(renameLoginGroup(h, "shared", "   "), false);
});
